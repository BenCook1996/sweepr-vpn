use tauri::{LogicalSize, Manager};

static DOORBELL_ENABLED: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Probes actual TCP connect RTT against VPN endpoints in parallel.
#[tauri::command]
async fn probe_server_latencies(
    targets: Vec<(String, String)>,
) -> Result<std::collections::HashMap<String, u32>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let results: Vec<(String, Option<u32>)> = std::thread::scope(|s| {
            let handles: Vec<_> = targets
                .into_iter()
                .map(|(code, endpoint)| {
                    s.spawn(move || {
                        let rtt = sweepr_tunnel::probe_endpoint_rtt_ms(&endpoint, 1500);
                        (code, rtt)
                    })
                })
                .collect();
            handles
                .into_iter()
                .filter_map(|h| h.join().ok())
                .collect()
        });
        let mut map = std::collections::HashMap::new();
        for (code, rtt) in results {
            if let Some(ms) = rtt {
                map.insert(code, ms);
            }
        }
        map
    })
    .await
    .map_err(|e| e.to_string())
}

#[cfg(target_os = "macos")]
fn read_sweepr_endpoint_from_conf(conf_file: &std::path::Path) -> Option<(String, String)> {
    let raw = std::fs::read_to_string(conf_file).ok()?;
    for line in raw.lines() {
        let trimmed = line.trim();
        if trimmed.to_ascii_lowercase().starts_with("endpoint") {
            if let Some((_, val)) = trimmed.split_once('=') {
                let v = val.trim();
                if let Some((host, port)) = v.rsplit_once(':') {
                    let h = host.trim_matches(|c| c == '[' || c == ']').trim();
                    let p = port.trim();
                    if !h.is_empty() && !p.is_empty() && p.chars().all(|c| c.is_ascii_digit()) {
                        if h.parse::<std::net::IpAddr>().is_ok() {
                            return Some((h.to_string(), p.to_string()));
                        }
                        if let Ok(port_num) = p.parse::<u16>() {
                            if let Ok(mut addrs) =
                                std::net::ToSocketAddrs::to_socket_addrs(&(h, port_num))
                            {
                                if let Some(sa) = addrs.next() {
                                    return Some((sa.ip().to_string(), p.to_string()));
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    None
}

/// Scans the home network and names every device (takes about 4 seconds).
#[tauri::command]
async fn scan_network() -> Result<sweepr_wifi_radar::ScanReport, String> {
    tauri::async_runtime::spawn_blocking(|| sweepr_wifi_radar::scan_network(Default::default()))
        .await
        .map_err(|e| e.to_string())?
}

/// Verifies that the user has an active paid SWEEPR VPN subscription.
#[tauri::command]
async fn activate_subscription(
    email: String,
    code: String,
    device_id: Option<String>,
) -> Result<sweepr_tunnel::SubscriptionStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sweepr_tunnel::verify_subscription_with_device(email, code, None, device_id)
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Returns current WireGuard tunnel status and this device's public key.
#[tauri::command]
async fn vpn_status() -> Result<sweepr_tunnel::TunnelStatus, String> {
    tauri::async_runtime::spawn_blocking(sweepr_tunnel::status)
        .await
        .map_err(|e| e.to_string())?
}

/// Negotiates a peer with SWEEPR's WireGuard API and brings up the OS WireGuard tunnel.
#[tauri::command]
async fn connect_vpn(
    server_code: String,
    email: Option<String>,
    activation_code: Option<String>,
    lan_bypass: Option<bool>,
    device_id: Option<String>,
) -> Result<sweepr_tunnel::TunnelStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sweepr_tunnel::connect(sweepr_tunnel::ConnectRequest {
            server_code,
            email,
            activation_code,
            api_url: None,
            lan_bypass,
            device_id,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Tears down the OS WireGuard tunnel cleanly.
#[tauri::command]
async fn disconnect_vpn() -> Result<sweepr_tunnel::TunnelStatus, String> {
    tauri::async_runtime::spawn_blocking(sweepr_tunnel::disconnect)
        .await
        .map_err(|e| e.to_string())?
}

/// Switches between the full window and the small always-on-top mini window.
#[tauri::command]
fn set_compact(window: tauri::WebviewWindow, compact: bool) -> Result<(), String> {
    let r = if compact {
        window
            .set_min_size(Some(LogicalSize::new(340.0, 480.0)))
            .and_then(|_| window.set_size(LogicalSize::new(380.0, 540.0)))
            .and_then(|_| window.set_always_on_top(true))
    } else {
        window
            .set_always_on_top(false)
            .and_then(|_| window.set_min_size(Some(LogicalSize::new(480.0, 520.0))))
            .and_then(|_| window.set_size(LogicalSize::new(1160.0, 770.0)))
    };
    r.map_err(|e| e.to_string())
}

/// Configures OS auto-start on login across Windows, macOS, and Linux.
#[tauri::command]
fn set_startup(enabled: bool) -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_str = exe.to_string_lossy().to_string();
    #[cfg(target_os = "windows")]
    {
        let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let reg_bin = std::path::Path::new(&sys_root).join("System32\\reg.exe");
        let reg_cmd = if reg_bin.exists() { reg_bin.to_string_lossy().to_string() } else { "reg".to_string() };
        let status = if enabled {
            std::process::Command::new(&reg_cmd)
                .args([
                    "add",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "SWEEPRVPN",
                    "/t",
                    "REG_SZ",
                    "/d",
                    &format!("\"{}\" --minimized", exe_str),
                    "/f",
                ])
                .status()
        } else {
            std::process::Command::new(&reg_cmd)
                .args([
                    "delete",
                    r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run",
                    "/v",
                    "SWEEPRVPN",
                    "/f",
                ])
                .status()
        };
        let _ = status;
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let plist_dir = std::path::PathBuf::from(home).join("Library/LaunchAgents");
            let _ = std::fs::create_dir_all(&plist_dir);
            let plist_path = plist_dir.join("com.sweepr.vpn.plist");
            if enabled {
                let escaped_exe = exe_str
                    .replace('&', "&amp;")
                    .replace('<', "&lt;")
                    .replace('>', "&gt;")
                    .replace('"', "&quot;")
                    .replace('\'', "&apos;");
                let content = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.sweepr.vpn</string>
<key>ProgramArguments</key><array><string>{}</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>"#,
                    escaped_exe
                );
                let _ = std::fs::write(plist_path, content);
            } else {
                let _ = std::fs::remove_file(plist_path);
            }
        }
    }
    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let dir = std::path::PathBuf::from(home).join(".config/autostart");
            let _ = std::fs::create_dir_all(&dir);
            let path = dir.join("sweepr-vpn.desktop");
            if enabled {
                let content = format!(
                    "[Desktop Entry]\nType=Application\nName=SWEEPR VPN\nExec=\"{}\"\nX-GNOME-Autostart-enabled=true\n",
                    exe_str
                );
                let _ = std::fs::write(path, content);
            } else {
                let _ = std::fs::remove_file(path);
            }
        }
    }
    Ok(())
}

fn app_config_dir() -> std::path::PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            return std::path::PathBuf::from(local).join("SweeprVPN");
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Ok(home) = std::env::var("HOME") {
            return std::path::PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("SweeprVPN");
        }
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return std::path::PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("sweepr-vpn");
        }
    }
    std::env::temp_dir().join("SweeprVPN")
}

/// Configures OS-level IPv6 / clearnet leak protection for the Emergency Kill Switch.
#[tauri::command]
fn set_kill_switch(enabled: bool) -> Result<serde_json::Value, String> {
    let dir = app_config_dir();
    let _ = std::fs::create_dir_all(&dir);
    let ks_path = dir.join("kill_switch.json");
    let mut state_json = serde_json::json!({
        "ok": true,
        "enabled": enabled,
        "updated_at": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
    let _ = std::fs::write(
        &ks_path,
        serde_json::to_string_pretty(&state_json).unwrap_or_default(),
    );

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let netsh_bin = std::path::Path::new(&sys_root).join("System32\\netsh.exe");
        let netsh_cmd = if netsh_bin.exists() { netsh_bin.to_string_lossy().to_string() } else { "netsh.exe".to_string() };
        let cmd_bin = std::path::Path::new(&sys_root).join("System32\\cmd.exe");
        let cmd_path = if cmd_bin.exists() { cmd_bin.to_string_lossy().to_string() } else { "cmd.exe".to_string() };
        let ps_bin = std::path::Path::new(&sys_root).join("System32\\WindowsPowerShell\\v1.0\\powershell.exe");
        let ps_path = if ps_bin.exists() { ps_bin.to_string_lossy().to_string() } else { "powershell.exe".to_string() };

        let del_cmd = format!("\"{netsh_cmd}\" advfirewall firewall delete rule name=SWEEPR_VPN_KillSwitch_IPv6 >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall delete rule name=SweeprVPN_KillSwitch_Block_IPv6 >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall delete rule name=SWEEPR_VPN_KillSwitch_DNS >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall delete rule name=SWEEPR_VPN_KillSwitch_Clearnet >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall delete rule name=SWEEPR_VPN_KillSwitch_Clearnet_TCP53 >nul 2>&1");
        let full_cmd = if enabled {
            format!(
                "{del_cmd} & \"{netsh_cmd}\" advfirewall firewall add rule name=SWEEPR_VPN_KillSwitch_IPv6 dir=out action=block protocol=IPV6 >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall add rule name=SWEEPR_VPN_KillSwitch_DNS dir=out action=allow protocol=UDP remoteport=53 remoteip=10.64.0.1,1.1.1.1,1.0.0.1,1.1.1.2,1.0.0.2,9.9.9.9 >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall add rule name=SWEEPR_VPN_KillSwitch_Clearnet dir=out action=block protocol=UDP remoteport=53 remoteip=0.0.0.0-1.0.0.0,1.0.0.3-1.1.1.0,1.1.1.3-9.9.9.8,9.9.9.10-10.64.0.0,10.64.0.2-255.255.255.255 >nul 2>&1 & \"{netsh_cmd}\" advfirewall firewall add rule name=SWEEPR_VPN_KillSwitch_Clearnet_TCP53 dir=out action=block protocol=TCP remoteport=53 remoteip=0.0.0.0-1.0.0.0,1.0.0.3-1.1.1.0,1.1.1.3-9.9.9.8,9.9.9.10-10.64.0.0,10.64.0.2-255.255.255.255 >nul 2>&1"
            )
        } else {
            del_cmd
        };
        let direct = std::process::Command::new(&cmd_path)
            .args(["/C", &full_cmd])
            .creation_flags(0x08000000)
            .status();
        if !direct.map(|s| s.success()).unwrap_or(false) {
            let ps = format!(
                "Start-Process -FilePath '{}' -ArgumentList '/c','\"{}\"' -Verb RunAs -WindowStyle Hidden -Wait",
                cmd_path.replace("'", "''"),
                full_cmd.replace("\"", "`\"")
            );
            let elevated = std::process::Command::new(&ps_path)
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
                .creation_flags(0x08000000)
                .status();
            if !elevated.map(|s| s.success()).unwrap_or(false) {
                state_json["ok"] = serde_json::json!(false);
                state_json["error"] = serde_json::json!("Administrator permission is required to update Kill Switch rules.");
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        let endpoint_rule = read_sweepr_endpoint_from_conf(&dir.join("sweepr0.conf"))
            .map(|(ip, port)| format!("pass out quick proto udp to {ip} port {port}\\n"))
            .unwrap_or_default();
        let pf_rules = format!(
            "pass quick on lo0 all\\n\
pass out quick to {{ 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16 }}\\n\
pass out quick proto udp from any port 68 to any port 67\\n\
{endpoint_rule}\
block return out all\\n"
        );
        let script = if enabled {
            let pf_conf_escaped = pf_rules.replace('"', "\\\"");
            format!(
                "do shell script \"printf '%s' \\\"{pf_conf_escaped}\\\" > /tmp/sweepr-pf.conf; \
UTUN=$(cat /var/run/wireguard/sweepr0.name 2>/dev/null || true); \
if [ -n \\\"$UTUN\\\" ]; then printf 'pass quick on %s all\\n%s' \\\"$UTUN\\\" \\\"$(cat /tmp/sweepr-pf.conf)\\\" > /tmp/sweepr-pf.conf; fi; \
(cat /etc/pf.conf; printf '\\nanchor \\\"com.sweepr.vpn\\\"\\n') | pfctl -f - >/dev/null 2>&1; \
pfctl -a com.sweepr.vpn -f /tmp/sweepr-pf.conf && (pfctl -E >/dev/null 2>&1 || true); \
networksetup -listallnetworkservices | tail -n +2 | grep -v '^[*]' | while IFS= read -r svc; do networksetup -setv6off \\\"$svc\\\" >/dev/null 2>&1 || true; done; \
dscacheutil -flushcache >/dev/null 2>&1 || true; killall -HUP mDNSResponder >/dev/null 2>&1 || true\" with administrator privileges"
            )
        } else {
            "do shell script \"pfctl -a com.sweepr.vpn -F all >/dev/null 2>&1 || true; \
rm -f /tmp/sweepr-pf.conf; \
pfctl -f /etc/pf.conf >/dev/null 2>&1 || true; \
networksetup -listallnetworkservices | tail -n +2 | grep -v '^[*]' | while IFS= read -r svc; do networksetup -setv6automatic \\\"$svc\\\" >/dev/null 2>&1 || true; done; \
dscacheutil -flushcache >/dev/null 2>&1 || true; killall -HUP mDNSResponder >/dev/null 2>&1 || true\" with administrator privileges".to_string()
        };
        let status = std::process::Command::new("osascript").args(["-e", &script]).status();
        if !status.map(|s| s.success()).unwrap_or(false) {
            state_json["ok"] = serde_json::json!(false);
            state_json["error"] = serde_json::json!("Administrator permission is required to configure the macOS Kill Switch.");
            let _ = std::fs::write(
                &ks_path,
                serde_json::to_string_pretty(&serde_json::json!({ "enabled": !enabled })).unwrap_or_default(),
            );
        }
    }
    #[cfg(target_os = "linux")]
    {
        let v = if enabled { "1" } else { "0" };
        let cmd = format!(
            "sysctl -w net.ipv6.conf.all.disable_ipv6={v} >/dev/null 2>&1 || true; sysctl -w net.ipv6.conf.default.disable_ipv6={v} >/dev/null 2>&1 || true"
        );
        let status = std::process::Command::new("sh")
            .args(["-c", &cmd])
            .status();
        if !status.map(|s| s.success()).unwrap_or(false) {
            let _ = std::process::Command::new("pkexec")
                .args(["sh", "-c", &cmd])
                .status();
        }
    }
    Ok(state_json)
}

/// Applies or removes Smart-TV ACR telemetry & streaming tracker sinkhole entries and probes the local router gateway.
#[tauri::command]
async fn set_smart_tv_shields(
    tv_acr: Option<bool>,
    streaming_ads: Option<bool>,
    router_check: Option<bool>,
) -> Result<serde_json::Value, String> {
    let dir = app_config_dir();
    let _ = std::fs::create_dir_all(&dir);
    let shields_path = dir.join("shields.json");

    let mut current: serde_json::Value = std::fs::read_to_string(&shields_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| {
            serde_json::json!({
                "tv_acr": true,
                "streaming_ads": true,
                "router_check": true
            })
        });

    let eff_tv_acr = tv_acr.unwrap_or_else(|| {
        current
            .get("tv_acr")
            .and_then(|v| v.as_bool())
            .unwrap_or(true)
    });
    let eff_streaming_ads = streaming_ads.unwrap_or_else(|| {
        current
            .get("streaming_ads")
            .and_then(|v| v.as_bool())
            .unwrap_or(true)
    });
    let eff_router_check = router_check.unwrap_or_else(|| {
        current
            .get("router_check")
            .and_then(|v| v.as_bool())
            .unwrap_or(true)
    });

    let any_enabled = eff_tv_acr || eff_streaming_ads;
    let active_dns = if any_enabled {
        "10.64.0.1, 1.1.1.2"
    } else {
        "10.64.0.1, 1.1.1.1"
    };

    let mut blocked_domains: Vec<&str> = Vec::new();
    if eff_tv_acr {
        blocked_domains.extend_from_slice(&[
            "acr0.samsungcloudsolution.com",
            "lcprd1.samsungcloudsolution.net",
            "ibis.lgappstv.com",
            "ad.lgappstv.com",
            "bravia.dl.playstation.net",
        ]);
    }
    if eff_streaming_ads {
        blocked_domains.extend_from_slice(&[
            "scribe.logs.roku.com",
            "cooper.logs.roku.com",
            "device-metrics-us.amazon.com",
            "fls-na.amazon.com",
        ]);
    }

    let (gateway_ip, open_ports) = if eff_router_check {
        tauri::async_runtime::spawn_blocking(|| {
            let gw = sweepr_wifi_radar::detect_gateway_ipv4();
            let mut open: Vec<u16> = Vec::new();
            if let Some(ip) = gw {
                for port in [21u16, 23, 7547] {
                    let addr = std::net::SocketAddr::new(std::net::IpAddr::V4(ip), port);
                    if std::net::TcpStream::connect_timeout(
                        &addr,
                        std::time::Duration::from_millis(300),
                    )
                    .is_ok()
                    {
                        open.push(port);
                    }
                }
            }
            (gw, open)
        })
        .await
        .unwrap_or((None, Vec::new()))
    } else {
        (sweepr_wifi_radar::detect_gateway_ipv4(), Vec::new())
    };

    let router_checked = eff_router_check && gateway_ip.is_some();
    let router_safe = open_ports.is_empty();
    let router_summary = if !eff_router_check {
        "Home router safety check paused".to_string()
    } else if let Some(gw) = gateway_ip {
        if open_ports.is_empty() {
            format!("Router gateway {gw} checked — Telnet/FTP/TR-069 remote-admin ports closed ✓")
        } else {
            format!(
                "Router {gw} has open port(s) {:?} — review remote admin settings",
                open_ports
            )
        }
    } else {
        "No local router gateway detected to probe".to_string()
    };

    current = serde_json::json!({
        "ok": true,
        "tv_acr": eff_tv_acr,
        "streaming_ads": eff_streaming_ads,
        "router_check": eff_router_check,
        "active_dns": active_dns,
        "blocked_domains": blocked_domains,
        "router": {
            "checked": router_checked,
            "safe": router_safe,
            "gateway_ip": gateway_ip.map(|ip| ip.to_string()),
            "open_ports": open_ports,
            "summary": router_summary
        }
    });

    let _ = std::fs::write(
        &shields_path,
        serde_json::to_string_pretty(&current).unwrap_or_default(),
    );

    // Update active tunnel WireGuard config DNS filter line if present
    let conf_file = dir.join("sweepr0.conf");
    if conf_file.exists() {
        if let Ok(raw_conf) = std::fs::read_to_string(&conf_file) {
            let updated_conf: String = raw_conf
                .lines()
                .map(|line| {
                    if line.trim_start().starts_with("DNS =") || line.trim_start().starts_with("DNS=") {
                        format!("DNS = {active_dns}")
                    } else {
                        line.to_string()
                    }
                })
                .collect::<Vec<_>>()
                .join("\n")
                + "\n";
            let _ = std::fs::write(&conf_file, updated_conf);
        }
    }

    let primary_dns = "10.64.0.1";
    let secondary_dns = if any_enabled { "1.1.1.2" } else { "1.1.1.1" };
    let tunnel_active = sweepr_tunnel::is_tunnel_active();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let sys_root = std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string());
        let netsh_bin = std::path::Path::new(&sys_root).join("System32\\netsh.exe");
        let netsh_cmd = if netsh_bin.exists() { netsh_bin.to_string_lossy().to_string() } else { "netsh.exe".to_string() };
        let ipconfig_bin = std::path::Path::new(&sys_root).join("System32\\ipconfig.exe");
        let ipconfig_cmd = if ipconfig_bin.exists() { ipconfig_bin.to_string_lossy().to_string() } else { "ipconfig.exe".to_string() };
        let cmd_bin = std::path::Path::new(&sys_root).join("System32\\cmd.exe");
        let cmd_path = if cmd_bin.exists() { cmd_bin.to_string_lossy().to_string() } else { "cmd.exe".to_string() };
        let ps_bin = std::path::Path::new(&sys_root).join("System32\\WindowsPowerShell\\v1.0\\powershell.exe");
        let ps_path = if ps_bin.exists() { ps_bin.to_string_lossy().to_string() } else { "powershell.exe".to_string() };

        if tunnel_active {
            let st1 = std::process::Command::new(&netsh_cmd)
                .args(["interface", "ip", "set", "dns", "name=sweepr0", "static", primary_dns, "primary"])
                .creation_flags(0x08000000)
                .status();
            let _ = std::process::Command::new(&netsh_cmd)
                .args(["interface", "ip", "add", "dns", "name=sweepr0", secondary_dns, "index=2"])
                .creation_flags(0x08000000)
                .status();
            if !st1.map(|s| s.success()).unwrap_or(false) {
                let dns_cmd = format!(
                    "\"{netsh_cmd}\" interface ip set dns name=sweepr0 static {} primary >nul 2>&1 & \"{netsh_cmd}\" interface ip add dns name=sweepr0 {} index=2 >nul 2>&1 & \"{ipconfig_cmd}\" /flushdns >nul 2>&1",
                    primary_dns, secondary_dns
                );
                let ps = format!(
                    "Start-Process -FilePath '{}' -ArgumentList '/c','\"{}\"' -Verb RunAs -WindowStyle Hidden -Wait",
                    cmd_path.replace("'", "''"),
                    dns_cmd.replace("\"", "`\"")
                );
                let _ = std::process::Command::new(&ps_path)
                    .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps])
                    .creation_flags(0x08000000)
                    .status();
            }
        }
        let _ = std::process::Command::new(&ipconfig_cmd)
            .args(["/flushdns"])
            .creation_flags(0x08000000)
            .status();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = tunnel_active;
        let _ = std::process::Command::new("dscacheutil")
            .args(["-flushcache"])
            .status();
    }
    #[cfg(target_os = "linux")]
    {
        if tunnel_active {
            let st = std::process::Command::new("resolvectl")
                .args(["dns", "sweepr0", primary_dns, secondary_dns])
                .status();
            let _ = std::process::Command::new("resolvectl")
                .args(["domain", "sweepr0", "~."])
                .status();
            if !st.map(|s| s.success()).unwrap_or(false) {
                let cmd = format!(
                    "resolvectl dns sweepr0 {} {} >/dev/null 2>&1 || true; resolvectl domain sweepr0 '~.' >/dev/null 2>&1 || true; resolvectl flush-caches >/dev/null 2>&1 || true",
                    primary_dns, secondary_dns
                );
                let _ = std::process::Command::new("pkexec")
                    .args(["sh", "-c", &cmd])
                    .status();
            }
        }
        let _ = std::process::Command::new("resolvectl")
            .args(["flush-caches"])
            .status();
    }

    Ok(current)
}

/// Checks if a newer or mandatory update of SWEEPR VPN is available.
#[tauri::command]
async fn check_app_update(
    app: tauri::AppHandle,
    api_url: Option<String>,
) -> Result<serde_json::Value, String> {
    let cur_ver = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || {
        sweepr_tunnel::check_version_update(&cur_ver, api_url)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn load_wifi_guard_json() -> serde_json::Value {
    let path = app_config_dir().join("wifi_guard_state.json");
    std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| {
            serde_json::json!({
                "doorbell_mode": true,
                "devices": {},
                "isp_plan": {
                    "isp_name": "Spectrum / Virgin Media",
                    "promised_mbps": 500.0,
                    "monthly_cost": 85.0,
                    "currency": "USD"
                },
                "speed_samples": []
            })
        })
}

fn save_wifi_guard_json(val: &serde_json::Value) {
    let dir = app_config_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("wifi_guard_state.json");
    let _ = std::fs::write(&path, serde_json::to_string_pretty(val).unwrap_or_default());
}

/// Saves a custom plain-English household nickname, trust/intruder state, or 1-Tap Kids Bedtime Pause schedule for a device.
#[tauri::command]
fn set_wifi_guard_device_policy(
    mac: String,
    custom_name: Option<String>,
    trust_state: Option<String>,
    paused: Option<bool>,
    bedtime_schedule: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut state = load_wifi_guard_json();
    let key = mac.trim().to_lowercase();
    if key.is_empty() {
        return Err("MAC or IP identifier required".into());
    }
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let devices = state
        .as_object_mut()
        .ok_or("Invalid state")?
        .entry("devices")
        .or_insert_with(|| serde_json::json!({}));
    let entry = devices
        .as_object_mut()
        .ok_or("Invalid devices map")?
        .entry(key)
        .or_insert_with(|| serde_json::json!({}));

    if let Some(obj) = entry.as_object_mut() {
        if let Some(name) = custom_name {
            obj.insert("custom_name".into(), serde_json::Value::String(name));
        }
        if let Some(trust) = trust_state {
            obj.insert("trust_state".into(), serde_json::Value::String(trust));
        }
        if let Some(p) = paused {
            obj.insert("paused".into(), serde_json::Value::Bool(p));
        }
        if let Some(sched) = bedtime_schedule {
            obj.insert("bedtime_schedule".into(), serde_json::Value::String(sched));
        }
        obj.insert("updated_at".into(), serde_json::json!(now));
    }

    save_wifi_guard_json(&state);
    Ok(state)
}

/// Toggles "Doorbell Mode for Wi-Fi" (instant alert when a new unrecognized device joins the Wi-Fi).
#[tauri::command]
fn set_doorbell_mode(enabled: bool) -> Result<serde_json::Value, String> {
    DOORBELL_ENABLED.store(enabled, std::sync::atomic::Ordering::Relaxed);
    let mut state = load_wifi_guard_json();
    if let Some(obj) = state.as_object_mut() {
        obj.insert("doorbell_mode".into(), serde_json::Value::Bool(enabled));
    }
    save_wifi_guard_json(&state);
    Ok(state)
}

/// Logs an ISP speed sample against the user's contracted plan to generate verified ISP bill-credit refund proof.
#[tauri::command]
async fn log_isp_speed_sample(
    isp_name: String,
    promised_mbps: f64,
    monthly_cost: f64,
    currency: String,
    measured_mbps: f64,
    ping_ms: f64,
) -> Result<serde_json::Value, String> {
    let mut state = load_wifi_guard_json();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let drop_pct = if promised_mbps > 0.0 {
        (((promised_mbps - measured_mbps) / promised_mbps) * 100.0).max(0.0).round()
    } else {
        0.0
    };
    let suggested_credit = (monthly_cost * (drop_pct / 100.0) * 0.5).clamp(15.0, 45.0).round();

    if let Some(obj) = state.as_object_mut() {
        obj.insert(
            "isp_plan".into(),
            serde_json::json!({
                "isp_name": isp_name,
                "promised_mbps": promised_mbps,
                "monthly_cost": monthly_cost,
                "currency": currency,
                "suggested_credit": suggested_credit
            }),
        );
        let samples = obj
            .entry("speed_samples")
            .or_insert_with(|| serde_json::json!([]));
        if let Some(arr) = samples.as_array_mut() {
            arr.insert(
                0,
                serde_json::json!({
                    "timestamp": now,
                    "measured_mbps": (measured_mbps * 10.0).round() / 10.0,
                    "promised_mbps": promised_mbps,
                    "drop_pct": drop_pct,
                    "ping_ms": (ping_ms * 10.0).round() / 10.0
                }),
            );
            if arr.len() > 90 {
                arr.truncate(90);
            }
        }
    }

    save_wifi_guard_json(&state);
    Ok(state)
}

/// Returns the persisted Wi-Fi Guard Home state (custom device names, bedtime pauses, Doorbell Mode, and ISP speed-drop log).
#[tauri::command]
fn get_wifi_guard_state() -> Result<serde_json::Value, String> {
    Ok(load_wifi_guard_json())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Headless scan for support and automated tests: `sweepr-vpn --scan-json`
    if std::env::args().any(|a| a == "--scan-json") {
        match sweepr_wifi_radar::scan_network(Default::default()) {
            Ok(r) => println!("{}", serde_json::to_string_pretty(&r).unwrap_or_default()),
            Err(e) => eprintln!("{e}"),
        }
        return;
    }

    // Headless tunnel status check: `sweepr-vpn --vpn-status`
    if std::env::args().any(|a| a == "--vpn-status") {
        match sweepr_tunnel::status() {
            Ok(s) => println!("{}", serde_json::to_string_pretty(&s).unwrap_or_default()),
            Err(e) => eprintln!("{e}"),
        }
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            scan_network,
            activate_subscription,
            vpn_status,
            connect_vpn,
            disconnect_vpn,
            set_compact,
            set_startup,
            set_kill_switch,
            set_smart_tv_shields,
            check_app_update,
            set_wifi_guard_device_policy,
            set_doorbell_mode,
            log_isp_speed_sample,
            get_wifi_guard_state,
            probe_server_latencies
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if let Ok(st) = sweepr_tunnel::status() {
                    if st.connected {
                        api.prevent_close();
                        let _ = window.minimize();
                    }
                }
            }
        })
        .setup(|app| {
            let start_minimized = std::env::args().any(|a| a == "--minimized");
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title("SWEEPR VPN");
                if let Some(icon) = app.default_window_icon().cloned() {
                    let _ = w.set_icon(icon);
                }
                if start_minimized {
                    let _ = w.minimize();
                }
            }
            let initial_doorbell = load_wifi_guard_json()
                .get("doorbell_mode")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            DOORBELL_ENABLED.store(initial_doorbell, std::sync::atomic::Ordering::Relaxed);
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let mut known_macs: std::collections::HashSet<String> =
                    std::collections::HashSet::new();
                let mut seeded = false;
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(90));
                    if !DOORBELL_ENABLED.load(std::sync::atomic::Ordering::Relaxed) {
                        continue;
                    }
                    if let Ok(report) = sweepr_wifi_radar::scan_network(Default::default()) {
                        if !seeded {
                            for d in &report.devices {
                                if !d.mac.is_empty() {
                                    known_macs.insert(d.mac.to_lowercase());
                                }
                            }
                            seeded = true;
                            continue;
                        }
                        for d in &report.devices {
                            let mac_key = d.mac.to_lowercase();
                            if mac_key.is_empty() || d.is_self || d.is_router {
                                continue;
                            }
                            if known_macs.insert(mac_key) {
                                if let Some(win) = app_handle.get_webview_window("main") {
                                    if let Ok(payload) = serde_json::to_string(d) {
                                        let js = format!(
                                            "window.onNativeIntruderAlert && window.onNativeIntruderAlert({payload});"
                                        );
                                        let _ = win.eval(&js);
                                    }
                                }
                            }
                        }
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SWEEPR VPN");
}
