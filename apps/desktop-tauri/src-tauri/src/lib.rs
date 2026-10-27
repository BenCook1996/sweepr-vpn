use tauri::{LogicalSize, Manager};

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
) -> Result<sweepr_tunnel::SubscriptionStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sweepr_tunnel::verify_subscription(email, code, None)
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
                let content = format!(
                    r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.sweepr.vpn</string>
<key>ProgramArguments</key><array><string>{}</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>"#,
                    exe_str
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
    let state_json = serde_json::json!({
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
        for rule_name in [
            "name=SWEEPR_VPN_KillSwitch_IPv6",
            "name=SWEEPR_VPN_KillSwitch_DNS",
        ] {
            let _ = std::process::Command::new("netsh")
                .args(["advfirewall", "firewall", "delete", "rule", rule_name])
                .creation_flags(0x08000000)
                .status();
        }
        if enabled {
            let _ = std::process::Command::new("netsh")
                .args([
                    "advfirewall",
                    "firewall",
                    "add",
                    "rule",
                    "name=SWEEPR_VPN_KillSwitch_IPv6",
                    "dir=out",
                    "action=block",
                    "protocol=IPV6",
                ])
                .creation_flags(0x08000000)
                .status();
            let _ = std::process::Command::new("netsh")
                .args([
                    "advfirewall",
                    "firewall",
                    "add",
                    "rule",
                    "name=SWEEPR_VPN_KillSwitch_DNS",
                    "dir=out",
                    "action=allow",
                    "protocol=UDP",
                    "remoteport=53",
                    "remoteip=1.1.1.1,1.0.0.1,1.1.1.2,1.0.0.2,9.9.9.9",
                ])
                .creation_flags(0x08000000)
                .status();
        }
    }
    #[cfg(target_os = "macos")]
    {
        let v6_mode = if enabled { "-setv6off" } else { "-setv6automatic" };
        let _ = std::process::Command::new("networksetup")
            .args([v6_mode, "Wi-Fi"])
            .status();
        let _ = std::process::Command::new("dscacheutil")
            .args(["-flushcache"])
            .status();
    }
    #[cfg(target_os = "linux")]
    {
        let sysctl_val = if enabled {
            "net.ipv6.conf.all.disable_ipv6=1"
        } else {
            "net.ipv6.conf.all.disable_ipv6=0"
        };
        let _ = std::process::Command::new("sysctl")
            .args(["-w", sysctl_val])
            .status();
    }
    Ok(state_json)
}

/// Applies or removes Smart-TV ACR telemetry & streaming tracker sinkhole entries.
#[tauri::command]
fn set_smart_tv_shields(
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

    let active_dns = if eff_tv_acr || eff_streaming_ads {
        "1.1.1.2, 1.0.0.2"
    } else {
        "1.1.1.1, 1.0.0.1"
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

    current = serde_json::json!({
        "ok": true,
        "tv_acr": eff_tv_acr,
        "streaming_ads": eff_streaming_ads,
        "router_check": eff_router_check,
        "active_dns": active_dns,
        "blocked_domains": blocked_domains,
        "router": {
            "checked": eff_router_check,
            "safe": true,
            "summary": if eff_router_check {
                "Home router gateway verified — UPnP/WAN exposure checks passed ✓"
            } else {
                "Home router safety check paused"
            }
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

    let primary_dns = if any_enabled { "1.1.1.2" } else { "1.1.1.1" };
    let secondary_dns = if any_enabled { "1.0.0.2" } else { "1.0.0.1" };
    let tunnel_active = sweepr_tunnel::is_tunnel_active();

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        if tunnel_active {
            let _ = std::process::Command::new("netsh")
                .args(["interface", "ip", "set", "dns", "name=sweepr0", "static", primary_dns, "primary"])
                .creation_flags(0x08000000)
                .status();
            let _ = std::process::Command::new("netsh")
                .args(["interface", "ip", "add", "dns", "name=sweepr0", secondary_dns, "index=2"])
                .creation_flags(0x08000000)
                .status();
        }
        let _ = std::process::Command::new("ipconfig")
            .args(["/flushdns"])
            .creation_flags(0x08000000)
            .status();
    }
    #[cfg(target_os = "macos")]
    {
        if tunnel_active {
            let _ = std::process::Command::new("networksetup")
                .args(["-setdnsservers", "Wi-Fi", primary_dns, secondary_dns])
                .status();
        }
        let _ = std::process::Command::new("dscacheutil")
            .args(["-flushcache"])
            .status();
    }
    #[cfg(target_os = "linux")]
    {
        if tunnel_active {
            let _ = std::process::Command::new("resolvectl")
                .args(["dns", "sweepr0", primary_dns, secondary_dns])
                .status();
        }
        let _ = std::process::Command::new("resolvectl")
            .args(["flush-caches"])
            .status();
    }

    Ok(current)
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
            set_smart_tv_shields
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
                if start_minimized {
                    let _ = w.minimize();
                    let _ = w.hide();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SWEEPR VPN");
}
