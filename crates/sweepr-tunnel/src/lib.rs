//! SWEEPR VPN WireGuard Tunnel Manager (`sweepr-tunnel`)
//!
//! - Generates & persists standard Curve25519 (RFC 7748 X25519) WireGuard keypairs
//! - Negotiates peer registration with the SWEEPR `/api/vpn/connect` API
//! - Writes `sweepr0.conf` and brings up a real OS WireGuard tunnel:
//!   - Windows 10/11: `wireguard.exe /installtunnelservice` (`WireGuardNT` kernel driver)
//!   - macOS: `wg-quick up`
//!   - Linux: `pkexec wg-quick up`
//! - Never reports `connected: true` unless the OS tunnel interface is genuinely active.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const TUNNEL_NAME: &str = "sweepr0";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPair {
    pub private_key: String,
    pub public_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectRequest {
    pub server_code: String,
    pub email: Option<String>,
    pub activation_code: Option<String>,
    pub api_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TunnelStatus {
    pub connected: bool,
    pub state: String,
    pub server_code: Option<String>,
    pub address: Option<String>,
    pub endpoint: Option<String>,
    pub dns: Option<String>,
    pub public_key: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct PersistedState {
    private_key: String,
    public_key: String,
    last_server_code: Option<String>,
    last_address: Option<String>,
    last_endpoint: Option<String>,
    last_dns: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ApiConnectResponse {
    ok: Option<bool>,
    error: Option<String>,
    message: Option<String>,
    endpoint: Option<String>,
    server_public_key: Option<String>,
    address: Option<String>,
    dns: Option<String>,
    allowed_ips: Option<String>,
}

// ---------------------------------------------------------------------------
// RFC 7748 Curve25519 / X25519 scalar multiplication for WireGuard keys
// ---------------------------------------------------------------------------

type Fe = [i64; 16];

fn fe_zero() -> Fe {
    [0; 16]
}

fn fe_one() -> Fe {
    let mut o = [0; 16];
    o[0] = 1;
    o
}

fn fe_add(a: &Fe, b: &Fe) -> Fe {
    let mut o = [0i64; 16];
    for i in 0..16 {
        o[i] = a[i] + b[i];
    }
    o
}

fn fe_sub(a: &Fe, b: &Fe) -> Fe {
    let mut o = [0i64; 16];
    for i in 0..16 {
        o[i] = a[i] - b[i];
    }
    o
}

fn fe_carry(o: &mut Fe) {
    for i in 0..16 {
        o[i] += 1i64 << 16;
        let c = o[i] >> 16;
        if i < 15 {
            o[i + 1] += c - 1;
        } else {
            o[0] += 38 * (c - 1);
        }
        o[i] -= c << 16;
    }
}

fn fe_mul(a: &Fe, b: &Fe) -> Fe {
    let mut t = [0i64; 31];
    for i in 0..16 {
        for j in 0..16 {
            t[i + j] += a[i] * b[j];
        }
    }
    for i in 0..15 {
        t[i] += 38 * t[i + 16];
    }
    let mut o = [0i64; 16];
    o.copy_from_slice(&t[..16]);
    fe_carry(&mut o);
    fe_carry(&mut o);
    o
}

fn fe_sq(a: &Fe) -> Fe {
    fe_mul(a, a)
}

fn fe_inv(inp: &Fe) -> Fe {
    let mut c = *inp;
    for i in (0..=253).rev() {
        c = fe_sq(&c);
        if i != 2 && i != 4 {
            c = fe_mul(&c, inp);
        }
    }
    c
}

fn cswap(p: &mut Fe, q: &mut Fe, b: i64) {
    let mask = !(b - 1);
    for i in 0..16 {
        let t = mask & (p[i] ^ q[i]);
        p[i] ^= t;
        q[i] ^= t;
    }
}

fn unpack25519(n: &[u8; 32]) -> Fe {
    let mut o = [0i64; 16];
    for i in 0..16 {
        o[i] = (n[2 * i] as i64) + ((n[2 * i + 1] as i64) << 8);
    }
    o[15] &= 0x7fff;
    o
}

fn pack25519(n: &Fe) -> [u8; 32] {
    let mut t = *n;
    fe_carry(&mut t);
    fe_carry(&mut t);
    fe_carry(&mut t);
    let mut m = [0i64; 16];
    for _ in 0..2 {
        m[0] = t[0] - 0xffed;
        for i in 1..15 {
            m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1);
            m[i - 1] &= 0xffff;
        }
        m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1);
        let b = (m[15] >> 16) & 1;
        m[14] &= 0xffff;
        cswap(&mut t, &mut m, 1 - b);
    }
    let mut o = [0u8; 32];
    for i in 0..16 {
        o[2 * i] = (t[i] & 0xff) as u8;
        o[2 * i + 1] = (t[i] >> 8) as u8;
    }
    o
}

/// Computes `X25519(scalar, point)` per RFC 7748.
pub fn x25519(scalar: &[u8; 32], point: &[u8; 32]) -> [u8; 32] {
    let mut z = *scalar;
    z[0] &= 248;
    z[31] = (z[31] & 127) | 64;

    let x = unpack25519(point);
    let mut a = fe_one();
    let mut b = x;
    let mut c = fe_zero();
    let mut d = fe_one();
    let mut a24 = fe_zero();
    a24[0] = 0xdb41;
    a24[1] = 1;

    for i in (0..255).rev() {
        let r = ((z[i >> 3] >> (i & 7)) & 1) as i64;
        cswap(&mut a, &mut b, r);
        cswap(&mut c, &mut d, r);

        let e = fe_add(&a, &c);
        let a_sub_c = fe_sub(&a, &c);
        let c_plus_d = fe_add(&b, &d);
        let b_sub_d = fe_sub(&b, &d);

        let d_sq = fe_sq(&e);
        let f = fe_sq(&a_sub_c);
        let a_mul = fe_mul(&c_plus_d, &a_sub_c);
        let c_mul = fe_mul(&b_sub_d, &e);

        let e_add = fe_add(&a_mul, &c_mul);
        let e_sub = fe_sub(&a_mul, &c_mul);

        b = fe_sq(&e_add);
        d = fe_sq(&e_sub);
        d = fe_mul(&d, &x);

        let g = fe_sub(&d_sq, &f);
        a = fe_mul(&d_sq, &f);
        let t = fe_mul(&g, &a24);
        let t_plus = fe_add(&t, &d_sq);
        c = fe_mul(&g, &t_plus);

        cswap(&mut a, &mut b, r);
        cswap(&mut c, &mut d, r);
    }

    let inv_c = fe_inv(&c);
    let res = fe_mul(&a, &inv_c);
    pack25519(&res)
}

/// Generates a fresh clamped Curve25519 WireGuard keypair.
pub fn generate_keypair() -> Result<KeyPair, String> {
    let mut priv_bytes = [0u8; 32];
    getrandom::fill(&mut priv_bytes).map_err(|e| format!("Random generator error: {e}"))?;
    priv_bytes[0] &= 248;
    priv_bytes[31] = (priv_bytes[31] & 127) | 64;

    let mut basepoint = [0u8; 32];
    basepoint[0] = 9;
    let pub_bytes = x25519(&priv_bytes, &basepoint);

    Ok(KeyPair {
        private_key: B64.encode(priv_bytes),
        public_key: B64.encode(pub_bytes),
    })
}

// ---------------------------------------------------------------------------
// App data paths & state persistence
// ---------------------------------------------------------------------------

fn app_data_dir() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return PathBuf::from(local).join("SweeprVPN");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("SweeprVPN");
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("sweepr-vpn");
        }
    }
    std::env::temp_dir().join("SweeprVPN")
}

fn state_path() -> PathBuf {
    app_data_dir().join("tunnel_state.json")
}

fn conf_path() -> PathBuf {
    app_data_dir().join(format!("{TUNNEL_NAME}.conf"))
}

fn load_or_create_state() -> Result<PersistedState, String> {
    let dir = app_data_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Could not create app folder: {e}"))?;
    let p = state_path();
    if p.exists() {
        if let Ok(raw) = fs::read_to_string(&p) {
            if let Ok(st) = serde_json::from_str::<PersistedState>(&raw) {
                if st.private_key.len() == 44 && st.public_key.len() == 44 {
                    return Ok(st);
                }
            }
        }
    }
    let kp = generate_keypair()?;
    let st = PersistedState {
        private_key: kp.private_key,
        public_key: kp.public_key,
        last_server_code: None,
        last_address: None,
        last_endpoint: None,
        last_dns: None,
    };
    save_state(&st)?;
    Ok(st)
}

fn save_state(st: &PersistedState) -> Result<(), String> {
    let dir = app_data_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(st).map_err(|e| e.to_string())?;
    fs::write(state_path(), json).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// API communication via OS curl (works on Windows 10/11, macOS, and Linux)
// ---------------------------------------------------------------------------

fn curl_bin() -> &'static str {
    #[cfg(target_os = "windows")]
    {
        "C:\\Windows\\System32\\curl.exe"
    }
    #[cfg(not(target_os = "windows"))]
    {
        "curl"
    }
}

fn call_connect_api(
    api_base: &str,
    public_key: &str,
    server_code: &str,
    email: Option<&str>,
    activation_code: Option<&str>,
) -> Result<ApiConnectResponse, String> {
    let url = format!("{}/api/vpn/connect", api_base.trim_end_matches('/'));
    let body = serde_json::json!({
        "public_key": public_key,
        "server_code": server_code,
        "email": email.unwrap_or(""),
        "activation_code": activation_code.unwrap_or("")
    })
    .to_string();

    let mut cmd = Command::new(curl_bin());
    cmd.args([
        "-sS",
        "--max-time",
        "10",
        "-X",
        "POST",
        "-H",
        "Content-Type: application/json",
        "-d",
        &body,
        &url,
    ]);
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let out = cmd
        .output()
        .map_err(|e| format!("Could not reach SWEEPR servers: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("Could not reach SWEEPR servers. Check your internet connection.".into());
    }
    serde_json::from_str::<ApiConnectResponse>(&stdout)
        .map_err(|_| "Unexpected response from SWEEPR server.".into())
}

// ---------------------------------------------------------------------------
// OS Tunnel Management (Windows / macOS / Linux)
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn find_wireguard_exe() -> Option<PathBuf> {
    let candidates = [
        PathBuf::from(r"C:\Program Files\WireGuard\wireguard.exe"),
        PathBuf::from(r"C:\Program Files (x86)\WireGuard\wireguard.exe"),
    ];
    for c in candidates {
        if c.exists() {
            return Some(c);
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let bundled = dir.join("wireguard.exe");
            if bundled.exists() {
                return Some(bundled);
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn ensure_wireguard_windows() -> Result<PathBuf, String> {
    if let Some(p) = find_wireguard_exe() {
        return Ok(p);
    }
    // Automatically download and install the official signed WireGuard Windows client
    let installer = app_data_dir().join("wireguard-installer.exe");
    let mut dl = Command::new(curl_bin());
    dl.args([
        "-sSL",
        "--max-time",
        "45",
        "-o",
        &installer.to_string_lossy(),
        "https://download.wireguard.com/windows-client/wireguard-installer.exe",
    ]);
    {
        use std::os::windows::process::CommandExt;
        dl.creation_flags(0x08000000);
    }
    let _ = dl.status();
    if installer.exists() {
        let ps = format!(
            "Start-Process -FilePath '{}' -ArgumentList '/install','/quiet' -Verb RunAs -Wait",
            installer.display()
        );
        let mut run = Command::new("powershell");
        run.args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps]);
        {
            use std::os::windows::process::CommandExt;
            run.creation_flags(0x08000000);
        }
        let _ = run.status();
    }
    find_wireguard_exe().ok_or_else(|| {
        "WireGuard tunnel driver is required. Please approve the Windows installer prompt and try again."
            .to_string()
    })
}

pub fn is_tunnel_active() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let svc_name = format!("WireGuardTunnel${TUNNEL_NAME}");
        if let Ok(out) = Command::new("sc")
            .args(["query", &svc_name])
            .creation_flags(0x08000000)
            .output()
        {
            let text = String::from_utf8_lossy(&out.stdout);
            return text.contains("RUNNING");
        }
        false
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(out) = Command::new("ifconfig").output() {
            let text = String::from_utf8_lossy(&out.stdout);
            return text.contains("10.64.");
        }
        false
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Path::new(&format!("/sys/class/net/{TUNNEL_NAME}")).exists()
    }
}

fn bring_tunnel_up(conf: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let wg_exe = ensure_wireguard_windows()?;
        let _ = bring_tunnel_down();
        let ps = format!(
            "Start-Process -FilePath '{}' -ArgumentList '/installtunnelservice','\"{}\"' -Verb RunAs -Wait",
            wg_exe.display(),
            conf.display()
        );
        let status = Command::new("powershell")
            .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
            .creation_flags(0x08000000)
            .status()
            .map_err(|e| format!("Failed to start WireGuard service: {e}"))?;
        if !status.success() {
            return Err("Administrator permission is required to start the VPN tunnel.".into());
        }
        for _ in 0..16 {
            if is_tunnel_active() {
                return Ok(());
            }
            std::thread::sleep(std::time::Duration::from_millis(250));
        }
        Err("WireGuard tunnel service did not reach RUNNING state.".into())
    }
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            "do shell script \"wg-quick down '{}' >/dev/null 2>&1 || true; wg-quick up '{}'\" with administrator privileges",
            conf.display(),
            conf.display()
        );
        let status = Command::new("osascript")
            .args(["-e", &script])
            .status()
            .map_err(|e| format!("Could not run wg-quick: {e}"))?;
        if status.success() && is_tunnel_active() {
            Ok(())
        } else {
            Err("Could not activate WireGuard tunnel on macOS (ensure wireguard-tools is installed).".into())
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = Command::new("pkexec")
            .args(["wg-quick", "down", &conf.to_string_lossy()])
            .status();
        let status = Command::new("pkexec")
            .args(["wg-quick", "up", &conf.to_string_lossy()])
            .status()
            .map_err(|e| format!("Could not run wg-quick: {e}"))?;
        if status.success() && is_tunnel_active() {
            Ok(())
        } else {
            Err("Could not activate WireGuard tunnel on Linux (ensure wireguard-tools is installed).".into())
        }
    }
}

pub fn bring_tunnel_down() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        if !is_tunnel_active() {
            return Ok(());
        }
        if let Some(wg_exe) = find_wireguard_exe() {
            let ps = format!(
                "Start-Process -FilePath '{}' -ArgumentList '/uninstalltunnelservice','{}' -Verb RunAs -Wait",
                wg_exe.display(),
                TUNNEL_NAME
            );
            let _ = Command::new("powershell")
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
                .creation_flags(0x08000000)
                .status();
        }
        Ok(())
    }
    #[cfg(target_os = "macos")]
    {
        let c = conf_path();
        if c.exists() {
            let script = format!(
                "do shell script \"wg-quick down '{}' >/dev/null 2>&1 || true\" with administrator privileges",
                c.display()
            );
            let _ = Command::new("osascript").args(["-e", &script]).status();
        }
        Ok(())
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let c = conf_path();
        if c.exists() {
            let _ = Command::new("pkexec")
                .args(["wg-quick", "down", &c.to_string_lossy()])
                .status();
        }
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Public API exposed to Tauri commands
// ---------------------------------------------------------------------------

pub fn status() -> Result<TunnelStatus, String> {
    let st = load_or_create_state()?;
    let active = is_tunnel_active();
    Ok(TunnelStatus {
        connected: active,
        state: if active { "connected".into() } else { "disconnected".into() },
        server_code: st.last_server_code,
        address: if active { st.last_address } else { None },
        endpoint: if active { st.last_endpoint } else { None },
        dns: if active { st.last_dns } else { None },
        public_key: st.public_key,
        message: if active {
            "Protected by WireGuard encryption".into()
        } else {
            "Not connected".into()
        },
    })
}

pub fn connect(req: ConnectRequest) -> Result<TunnelStatus, String> {
    let mut st = load_or_create_state()?;

    let env_url = std::env::var("SWEEPR_API_URL").ok();
    let candidates: Vec<String> = if let Some(u) = req.api_url.clone().or(env_url) {
        vec![u]
    } else {
        vec![
            "http://127.0.0.1:8080".to_string(),
            "http://127.0.0.1:3000".to_string(),
            "https://sweeprvpn.com".to_string(),
        ]
    };

    let mut last_err = String::from("Could not reach SWEEPR servers.");
    let mut resp_opt: Option<ApiConnectResponse> = None;

    for base in &candidates {
        match call_connect_api(
            base,
            &st.public_key,
            &req.server_code,
            req.email.as_deref(),
            req.activation_code.as_deref(),
        ) {
            Ok(r) => {
                resp_opt = Some(r);
                break;
            }
            Err(e) => {
                last_err = e;
            }
        }
    }

    let resp = resp_opt.ok_or(last_err)?;
    if resp.ok != Some(true) {
        let msg = resp.message.unwrap_or_else(|| {
            match resp.error.as_deref() {
                Some("licence_required") => {
                    "Enter your activation code in Account & Help to connect.".into()
                }
                Some("server_unavailable") => format!(
                    "No VPN server is online for {} yet. Provision it with scripts/provision-node.mjs.",
                    req.server_code
                ),
                _ => "Could not connect to this VPN location right now.".into(),
            }
        });
        return Err(msg);
    }

    let endpoint = resp.endpoint.ok_or("Server did not return an endpoint.")?;
    let server_pub = resp
        .server_public_key
        .ok_or("Server did not return a WireGuard public key.")?;
    let address = resp.address.unwrap_or_else(|| "10.64.0.2/32".into());
    let dns = resp.dns.unwrap_or_else(|| "10.64.0.1".into());
    let allowed_ips = resp.allowed_ips.unwrap_or_else(|| "0.0.0.0/0".into());

    let wg_conf = format!(
        "[Interface]\nPrivateKey = {}\nAddress = {}\nDNS = {}\n\n[Peer]\nPublicKey = {}\nEndpoint = {}\nAllowedIPs = {}\nPersistentKeepalive = 25\n",
        st.private_key, address, dns, server_pub, endpoint, allowed_ips
    );

    let cpath = conf_path();
    fs::write(&cpath, wg_conf).map_err(|e| format!("Could not write tunnel config: {e}"))?;

    bring_tunnel_up(&cpath)?;

    st.last_server_code = Some(req.server_code.clone());
    st.last_address = Some(address.clone());
    st.last_endpoint = Some(endpoint.clone());
    st.last_dns = Some(dns.clone());
    let _ = save_state(&st);

    Ok(TunnelStatus {
        connected: true,
        state: "connected".into(),
        server_code: Some(req.server_code),
        address: Some(address),
        endpoint: Some(endpoint),
        dns: Some(dns),
        public_key: st.public_key,
        message: "Protected by WireGuard encryption".into(),
    })
}

pub fn disconnect() -> Result<TunnelStatus, String> {
    bring_tunnel_down()?;
    status()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rfc7748_test_vector_and_wireguard_key_format() {
        // RFC 7748 Section 6.1 Alice private key
        let scalar: [u8; 32] = [
            0x77, 0x07, 0x6d, 0x0a, 0x73, 0x18, 0xa5, 0x7d, 0x3c, 0x16, 0xc1, 0x72, 0x51, 0xb2,
            0x66, 0x45, 0xdf, 0x4c, 0x2f, 0x87, 0xeb, 0xc0, 0x99, 0x2a, 0xb1, 0x77, 0xfb, 0xa5,
            0x1d, 0xb9, 0x2c, 0x2a,
        ];
        let mut base = [0u8; 32];
        base[0] = 9;
        let expected: [u8; 32] = [
            0x85, 0x20, 0xf0, 0x09, 0x89, 0x30, 0xa7, 0x54, 0x74, 0x8b, 0x7d, 0xdc, 0xb4, 0x3e,
            0xf7, 0x5a, 0x0d, 0xbf, 0x3a, 0x0d, 0x26, 0x38, 0x1a, 0xf4, 0xeb, 0xa4, 0xa9, 0x8e,
            0xaa, 0x9b, 0x4e, 0x6a,
        ];
        assert_eq!(x25519(&scalar, &base), expected);

        let kp = generate_keypair().unwrap();
        assert_eq!(kp.private_key.len(), 44);
        assert_eq!(kp.public_key.len(), 44);
        assert!(kp.public_key.ends_with('='));
    }
}
