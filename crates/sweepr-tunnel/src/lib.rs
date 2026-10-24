//! SWEEPR VPN WireGuard Tunnel Manager (`sweepr-tunnel`)
//!
//! - Generates & persists standard Curve25519 (RFC 7748 X25519) WireGuard keypairs
//! - Negotiates peer registration with the SWEEPR `/api/vpn/connect` API
//! - Writes `sweepr0.conf` and brings up a real OS WireGuard tunnel:
//!   - Windows 10/11: `wireguard.exe /installtunnelservice` (`WireGuardNT` kernel driver)
//!   - macOS: `wg-quick up`
//!   - Linux: `pkexec wg-quick up`
//! - Never reports `connected: true` unless the OS tunnel interface is genuinely active.

use base64::{
    engine::general_purpose::{STANDARD as B64, URL_SAFE_NO_PAD as B64URL},
    Engine as _,
};
use ed25519_dalek::{Signature, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const TUNNEL_NAME: &str = "sweepr0";
const SWEEPR_LICENSE_PUBLIC_KEY_B64URL: &str = "t04hn-7TfW5RIemEhi4mKbZy6rHRYBO6HxeN5OOIR_8";

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
pub struct SubscriptionStatus {
    pub active: bool,
    pub plan: Option<String>,
    pub wifi_radar: bool,
    pub license_key: Option<String>,
    pub activation_code: Option<String>,
    pub message: String,
}

#[derive(Debug, Deserialize)]
struct ApiActivateResponse {
    ok: Option<bool>,
    valid: Option<bool>,
    status: Option<String>,
    plan: Option<String>,
    #[serde(rename = "licenseKey")]
    license_key: Option<String>,
    activation_code: Option<String>,
    entitlements: Option<serde_json::Value>,
    token: Option<String>,
    license_token: Option<String>,
    message: Option<String>,
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

fn write_private_file(path: &Path, contents: &str) -> Result<(), String> {
    fs::write(path, contents).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(path, fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

fn save_state(st: &PersistedState) -> Result<(), String> {
    let dir = app_data_dir();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(st).map_err(|e| e.to_string())?;
    write_private_file(&state_path(), &json)
}

// ---------------------------------------------------------------------------
// API communication via OS curl (works on Windows 10/11, macOS, and Linux)
// ---------------------------------------------------------------------------

#[cfg(target_os = "windows")]
fn powershell_bin() -> PathBuf {
    let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    let p = Path::new(&sys_root).join("System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    if p.exists() { p } else { PathBuf::from("powershell.exe") }
}

#[cfg(target_os = "windows")]
fn sc_bin() -> PathBuf {
    let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
    let p = Path::new(&sys_root).join("System32\\sc.exe");
    if p.exists() { p } else { PathBuf::from("sc.exe") }
}

fn curl_bin() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let p = Path::new(&sys_root).join("System32\\curl.exe");
        if p.exists() { p } else { PathBuf::from("curl.exe") }
    }
    #[cfg(not(target_os = "windows"))]
    {
        PathBuf::from("curl")
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
        "activation_code": activation_code.unwrap_or(""),
        "license_key": activation_code.unwrap_or("")
    })
    .to_string();

    let mut cmd = Command::new(curl_bin());
    cmd.args([
        "-sS",
        "--retry",
        "2",
        "--retry-delay",
        "1",
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

fn call_activate_api(
    api_base: &str,
    email: &str,
    code: &str,
) -> Result<ApiActivateResponse, String> {
    let url = format!("{}/api/vpn/activate", api_base.trim_end_matches('/'));
    let body = serde_json::json!({
        "email": email.trim(),
        "key": code.trim(),
        "activation_code": code.trim(),
        "otp": code.trim(),
        "os": std::env::consts::OS,
        "app_version": "2.5.0"
    })
    .to_string();

    let mut cmd = Command::new(curl_bin());
    cmd.args([
        "-sS",
        "--retry",
        "2",
        "--retry-delay",
        "1",
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
        cmd.creation_flags(0x08000000);
    }

    let out = cmd
        .output()
        .map_err(|e| format!("Could not reach SWEEPR servers: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if stdout.is_empty() {
        return Err("Could not reach SWEEPR servers. Check your internet connection.".into());
    }
    serde_json::from_str::<ApiActivateResponse>(&stdout)
        .map_err(|_| "Unexpected response from SWEEPR server.".into())
}

pub fn verify_ed25519_license_token(token: &str) -> Result<(), String> {
    let parts: Vec<&str> = token.trim().split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid license signature format.".into());
    }
    let header_bytes = B64URL
        .decode(parts[0])
        .map_err(|_| "Malformed license token header.".to_string())?;
    let header: serde_json::Value = serde_json::from_slice(&header_bytes)
        .map_err(|_| "Invalid license token header JSON.".to_string())?;
    let kid = header.get("kid").and_then(|v| v.as_str()).unwrap_or("ed25519-2026-01");
    let pub_key_b64 = match kid {
        "ed25519-2026-01" | _ => SWEEPR_LICENSE_PUBLIC_KEY_B64URL,
    };

    let signing_input = format!("{}.{}", parts[0], parts[1]);
    let sig_bytes = B64URL
        .decode(parts[2])
        .map_err(|_| "Malformed license signature.".to_string())?;
    let sig_arr: [u8; 64] = sig_bytes
        .try_into()
        .map_err(|_| "Invalid Ed25519 signature length.".to_string())?;
    let signature = Signature::from_bytes(&sig_arr);

    let pub_bytes = B64URL
        .decode(pub_key_b64)
        .map_err(|_| "Internal public key decode error.".to_string())?;
    let pub_arr: [u8; 32] = pub_bytes
        .try_into()
        .map_err(|_| "Internal public key length error.".to_string())?;
    let verifying_key = VerifyingKey::from_bytes(&pub_arr)
        .map_err(|_| "Internal Ed25519 key error.".to_string())?;

    verifying_key
        .verify(signing_input.as_bytes(), &signature)
        .map_err(|_| "License token failed cryptographic Ed25519 signature verification.".to_string())?;

    let payload_bytes = B64URL
        .decode(parts[1])
        .map_err(|_| "Malformed license token payload.".to_string())?;
    let claims: serde_json::Value = serde_json::from_slice(&payload_bytes)
        .map_err(|_| "Invalid license token claims.".to_string())?;

    let status = claims.get("status").and_then(|v| v.as_str()).unwrap_or("");
    if status != "active" && status != "trialing" {
        return Err("Subscription in signed license token is not active.".into());
    }

    if let Some(exp) = claims.get("exp").and_then(|v| v.as_u64()) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);
        if now > exp + 300 {
            return Err("Signed license token has expired.".into());
        }
    }

    Ok(())
}

fn is_allowed_api_url(u: &str, allow_local: bool) -> bool {
    let trimmed = u.trim();
    if trimmed.is_empty() || trimmed.chars().any(|c| c.is_whitespace() || c.is_control()) {
        return false;
    }
    // Only allow verified SWEEPR VPN production HTTPS endpoints to prevent SSRF / credential exfiltration
    if let Some(rest) = trimmed.strip_prefix("https://") {
        let host_and_rest = rest.split('/').next().unwrap_or("");
        let host = host_and_rest.split(':').next().unwrap_or("").to_ascii_lowercase();
        if host == "sweeprvpn.com" || host == "www.sweeprvpn.com" || host == "api.sweeprvpn.com" {
            return true;
        }
    }
    allow_local
        && (trimmed.starts_with("http://127.0.0.1:")
            || trimmed.starts_with("http://localhost:"))
}

fn default_api_candidates(api_url: Option<String>) -> Vec<String> {
    let allow_local = cfg!(debug_assertions)
        || std::env::var("SWEEPR_ALLOW_LOCAL_API")
            .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
            .unwrap_or(false);
    let env_url = std::env::var("SWEEPR_API_URL").ok();
    if let Some(u) = api_url.or(env_url) {
        if is_allowed_api_url(&u, allow_local) {
            return vec![u.trim().trim_end_matches('/').to_string()];
        }
    }
    if allow_local {
        vec![
            "http://127.0.0.1:8788".to_string(),
            "http://127.0.0.1:8080".to_string(),
            "https://sweeprvpn.com".to_string(),
        ]
    } else {
        vec!["https://sweeprvpn.com".to_string()]
    }
}

pub fn verify_subscription(
    email: String,
    code: String,
    api_url: Option<String>,
) -> Result<SubscriptionStatus, String> {
    let clean_email = email.trim();
    let clean_code: String = code
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect::<String>()
        .to_ascii_uppercase();
    if clean_code.len() < 6 {
        return Err("Please enter the license key from your order.".into());
    }

    let candidates = default_api_candidates(api_url);

    let mut last_err = String::from("Could not reach SWEEPR subscription server.");
    let mut resp_opt: Option<ApiActivateResponse> = None;

    for base in &candidates {
        match call_activate_api(base, clean_email, &clean_code) {
            Ok(r) => {
                let is_ok = r.ok == Some(true) && r.valid == Some(true);
                if is_ok {
                    resp_opt = Some(r);
                    break;
                } else {
                    if let Some(ref m) = r.message {
                        last_err = m.clone();
                    }
                    if resp_opt.is_none() {
                        resp_opt = Some(r);
                    }
                }
            }
            Err(e) => {
                last_err = e;
            }
        }
    }

    let resp = resp_opt.ok_or(last_err)?;
    let is_active = resp.ok == Some(true)
        && resp.valid == Some(true)
        && matches!(resp.status.as_deref(), Some("active") | Some("trialing") | None);

    if !is_active {
        let msg = resp.message.unwrap_or_else(|| {
            "No active paid subscription found for that email and license key.".into()
        });
        return Err(msg);
    }

    let signed_token = resp
        .token
        .as_deref()
        .or(resp.license_token.as_deref())
        .ok_or_else(|| "Server response missing cryptographic Ed25519 license signature.".to_string())?;
    verify_ed25519_license_token(signed_token)?;

    let wifi_radar = resp
        .entitlements
        .as_ref()
        .and_then(|e| e.get("addons"))
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .any(|v| v.as_str().map(|s| s.contains("wifi_radar")).unwrap_or(false))
        })
        .unwrap_or(true);

    Ok(SubscriptionStatus {
        active: true,
        plan: resp.plan,
        wifi_radar,
        license_key: resp.license_key,
        activation_code: resp.activation_code.or_else(|| Some(clean_code.to_string())),
        message: "Active SWEEPR Pro subscription verified".into(),
    })
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
    let dl_ok = dl.status().map(|s| s.success()).unwrap_or(false);
    if dl_ok && installer.exists() {
        let ps = format!(
            "$p = '{}'; $sig = Get-AuthenticodeSignature -LiteralPath $p; if ($sig.Status -ne 'Valid') {{ Remove-Item -LiteralPath $p -Force -ErrorAction SilentlyContinue; exit 1 }}; Start-Process -FilePath $p -ArgumentList '/install','/quiet' -Verb RunAs -Wait",
            installer.display()
        );
        let mut run = Command::new(powershell_bin());
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
        if let Ok(out) = Command::new(sc_bin())
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
        let status = Command::new(powershell_bin())
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
            let _ = Command::new(powershell_bin())
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
    let email = req.email.as_deref().unwrap_or("").trim();
    let code = req.activation_code.as_deref().unwrap_or("").trim();
    if email.is_empty() || code.len() < 6 {
        return Err(
            "An active paid SWEEPR Pro subscription is required. Please enter your activation code or upgrade."
                .into(),
        );
    }

    let mut st = load_or_create_state()?;

    let candidates = default_api_candidates(req.api_url.clone());

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

    let endpoint = resp.endpoint.ok_or("Server did not return an endpoint.")?.trim().to_string();
    let server_pub = resp
        .server_public_key
        .ok_or("Server did not return a WireGuard public key.")?
        .trim()
        .to_string();
    let address = resp.address.unwrap_or_else(|| "10.64.0.2/32".into()).trim().to_string();
    let dns = resp.dns.unwrap_or_else(|| "10.64.0.1".into()).trim().to_string();
    let raw_allowed_ips = resp
        .allowed_ips
        .unwrap_or_else(|| "0.0.0.0/0, ::/0".into())
        .trim()
        .to_string();
    // Enforce dual-stack AllowedIPs (::/0) so IPv6 never leaks outside the WireGuard tunnel
    let allowed_ips = if raw_allowed_ips.contains(':') {
        raw_allowed_ips
    } else {
        format!("{raw_allowed_ips}, ::/0")
    };

    validate_wg_conf_fields(&server_pub, &endpoint, &address, &dns, &allowed_ips)?;

    let wg_conf = format!(
        "[Interface]\nPrivateKey = {}\nAddress = {}\nDNS = {}\n\n[Peer]\nPublicKey = {}\nEndpoint = {}\nAllowedIPs = {}\nPersistentKeepalive = 25\n",
        st.private_key, address, dns, server_pub, endpoint, allowed_ips
    );

    let cpath = conf_path();
    write_private_file(&cpath, &wg_conf).map_err(|e| format!("Could not write tunnel config: {e}"))?;

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

fn validate_wg_conf_fields(
    server_pub: &str,
    endpoint: &str,
    address: &str,
    dns: &str,
    allowed_ips: &str,
) -> Result<(), String> {
    if server_pub.len() != 44
        || !server_pub.ends_with('=')
        || !server_pub[..43]
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '+' || c == '/')
    {
        return Err("Invalid server WireGuard public key.".into());
    }
    if endpoint.parse::<std::net::SocketAddr>().is_err() {
        return Err("Invalid server WireGuard endpoint address.".into());
    }
    let (addr_ip, addr_prefix) = address
        .split_once('/')
        .ok_or_else(|| "Invalid tunnel IPv4 CIDR address.".to_string())?;
    if addr_ip.parse::<std::net::Ipv4Addr>().is_err()
        || addr_prefix
            .parse::<u8>()
            .map(|p| p > 32)
            .unwrap_or(true)
    {
        return Err("Invalid tunnel IPv4 CIDR address.".into());
    }
    if dns.parse::<std::net::Ipv4Addr>().is_err() {
        return Err("Invalid tunnel DNS IPv4 address.".into());
    }
    for token in allowed_ips.split(',') {
        let tok = token.trim();
        let (ip_str, pref_str) = tok
            .split_once('/')
            .ok_or_else(|| "Invalid AllowedIPs CIDR entry.".to_string())?;
        let ip = ip_str
            .parse::<std::net::IpAddr>()
            .map_err(|_| "Invalid AllowedIPs IP address.".to_string())?;
        let max_pref = if ip.is_ipv4() { 32 } else { 128 };
        if pref_str
            .parse::<u8>()
            .map(|p| p > max_pref)
            .unwrap_or(true)
        {
            return Err("Invalid AllowedIPs prefix length.".into());
        }
    }
    Ok(())
}

/// Measures physical network RTT (ms) to a VPN node endpoint using a bounded TCP handshake probe.
pub fn probe_endpoint_rtt_ms(endpoint: &str, timeout_ms: u64) -> Option<u32> {
    let addr: std::net::SocketAddr = endpoint.parse().ok()?;
    let probe_addr = std::net::SocketAddr::new(addr.ip(), 8787);
    let t0 = std::time::Instant::now();
    let _ = std::net::TcpStream::connect_timeout(
        &probe_addr,
        std::time::Duration::from_millis(timeout_ms),
    )
    .ok()?;
    Some(t0.elapsed().as_millis() as u32)
}

pub fn disconnect() -> Result<TunnelStatus, String> {
    bring_tunnel_down()?;
    let _ = fs::remove_file(conf_path());
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

        // Verify forged/unsigned token is rejected by Ed25519 verifier
        assert!(verify_ed25519_license_token("eyJhbGciOiJFZERTQSJ9.eyJzdGF0dXMiOiJhY3RpdmUifQ.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA").is_err());

        // Verify valid WireGuard config fields (including dual-stack IPv6 ::/0) pass and newline/PostUp injection is rejected
        assert!(validate_wg_conf_fields(&kp.public_key, "78.141.205.68:51820", "10.64.0.2/32", "10.64.0.1", "0.0.0.0/0, ::/0").is_ok());
        assert!(validate_wg_conf_fields(&kp.public_key, "78.141.205.68:51820", "10.64.0.2/32\nPostUp = calc.exe", "10.64.0.1", "0.0.0.0/0").is_err());
        assert!(validate_wg_conf_fields(&kp.public_key, "78.141.205.68:51820", "10.64.0.2/32", "10.64.0.1\nPostUp = id", "0.0.0.0/0").is_err());

        // SSRF defense: Verify untrusted domains are rejected and trusted SWEEPR domains are accepted
        assert!(is_allowed_api_url("https://sweeprvpn.com", false));
        assert!(is_allowed_api_url("https://www.sweeprvpn.com/api", false));
        assert!(is_allowed_api_url("https://api.sweeprvpn.com:443", false));
        assert!(!is_allowed_api_url("https://attacker-controlled.com", false));
        assert!(!is_allowed_api_url("https://sweeprvpn.com.attacker.com", false));
        assert!(!is_allowed_api_url("http://127.0.0.1:8080", false));
        assert!(is_allowed_api_url("http://127.0.0.1:8080", true));
    }
}
