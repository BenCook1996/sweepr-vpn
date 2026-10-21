use tauri::{LogicalSize, Manager};

/// Scans the home network and names every device (takes about 4 seconds).
#[tauri::command]
async fn scan_network() -> Result<sweepr_wifi_radar::ScanReport, String> {
    tauri::async_runtime::spawn_blocking(|| sweepr_wifi_radar::scan_network(Default::default()))
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
    api_url: Option<String>,
) -> Result<sweepr_tunnel::TunnelStatus, String> {
    tauri::async_runtime::spawn_blocking(move || {
        sweepr_tunnel::connect(sweepr_tunnel::ConnectRequest {
            server_code,
            email,
            activation_code,
            api_url,
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
            .set_min_size(Some(LogicalSize::new(480.0, 600.0)))
            .and_then(|_| window.set_size(LogicalSize::new(560.0, 700.0)))
            .and_then(|_| window.set_always_on_top(true))
    } else {
        window
            .set_always_on_top(false)
            .and_then(|_| window.set_min_size(Some(LogicalSize::new(1020.0, 680.0))))
            .and_then(|_| window.set_size(LogicalSize::new(1160.0, 770.0)))
            .and_then(|_| window.center())
    };
    r.map_err(|e| e.to_string())
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
            vpn_status,
            connect_vpn,
            disconnect_vpn,
            set_compact
        ])
        .setup(|app| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_title("SWEEPR VPN");
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SWEEPR VPN");
}
