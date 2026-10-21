fn main() {
    let started = std::time::Instant::now();
    let report = sweepr_wifi_radar::scan_network(sweepr_wifi_radar::ScanOptions::default());
    match report {
        Ok(r) => {
            println!("{}", serde_json::to_string_pretty(&r).unwrap());
            eprintln!("scan took {:.1}s", started.elapsed().as_secs_f32());
        }
        Err(e) => {
            eprintln!("scan failed: {e}");
            std::process::exit(1);
        }
    }
}
