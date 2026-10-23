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
) -> Result<sweepr_tunnel::TunnelStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sweepr_tunnel::connect(sweepr_tunnel::ConnectRequest {
            server_code,
            email,
            activation_code,
            api_url: None,
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
        let status = if enabled {
            std::process::Command::new("reg")
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
            std::process::Command::new("reg")
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
            set_startup
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
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title("SWEEPR VPN");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SWEEPR VPN");
}
