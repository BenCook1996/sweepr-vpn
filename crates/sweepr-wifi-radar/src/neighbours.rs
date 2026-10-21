//! Reads the operating system's neighbour (ARP) table.
use std::net::Ipv4Addr;
use std::process::Command;

pub fn normalise_mac(raw: &str) -> Option<String> {
    let parts: Vec<&str> = raw.trim().split(|c| c == ':' || c == '-').collect();
    if parts.len() != 6 { return None; }
    let mut out = Vec::with_capacity(6);
    for p in parts {
        let v = u8::from_str_radix(p, 16).ok()?;
        out.push(format!("{v:02x}"));
    }
    let mac = out.join(":");
    if mac == "ff:ff:ff:ff:ff:ff" || mac == "00:00:00:00:00:00" { return None; }
    // Multicast hardware addresses are not real devices.
    let first = u8::from_str_radix(&mac[0..2], 16).ok()?;
    if first & 0x01 == 1 { return None; }
    Some(mac)
}

/// Randomised "private" addresses have the locally-administered bit set.
pub fn is_locally_administered(mac: &str) -> bool {
    u8::from_str_radix(mac.get(0..2).unwrap_or("00"), 16).map(|b| b & 0x02 != 0).unwrap_or(false)
}

fn run(cmd: &str, args: &[&str]) -> String {
    let mut c = Command::new(cmd);
    c.args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x0800_0000); // CREATE_NO_WINDOW: no console flash
    }
    c.output().map(|o| String::from_utf8_lossy(&o.stdout).into_owned()).unwrap_or_default()
}

fn find_ip(tok: &str) -> Option<Ipv4Addr> {
    tok.trim_matches(|c| c == '(' || c == ')').parse().ok()
}

#[allow(unused_variables)]
pub fn read_table(local_ip: Ipv4Addr) -> Vec<(Ipv4Addr, String)> {
    let mut out = Vec::new();

    #[cfg(target_os = "linux")]
    {
        // IP address  HW type  Flags  HW address  Mask  Device
        if let Ok(text) = std::fs::read_to_string("/proc/net/arp") {
            for line in text.lines().skip(1) {
                let f: Vec<&str> = line.split_whitespace().collect();
                if f.len() >= 4 && f[2] != "0x0" {
                    if let (Some(ip), Some(mac)) = (find_ip(f[0]), normalise_mac(f[3])) { out.push((ip, mac)); }
                }
            }
        }
        if out.is_empty() {
            // "192.168.1.1 dev wlan0 lladdr 60:d8:a4:55:b8:35 REACHABLE"
            for line in run("ip", &["-4", "neigh"]).lines() {
                let f: Vec<&str> = line.split_whitespace().collect();
                if let Some(pos) = f.iter().position(|t| *t == "lladdr") {
                    if let (Some(ip), Some(mac)) = (f.first().and_then(|t| find_ip(t)), f.get(pos + 1).and_then(|m| normalise_mac(m))) { out.push((ip, mac)); }
                }
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // "? (192.168.1.1) at 60:d8:a4:55:b8:35 on en0 ifscope [ethernet]"
        for line in run("arp", &["-an"]).lines() {
            let f: Vec<&str> = line.split_whitespace().collect();
            if f.len() >= 4 && f[2] == "at" {
                if let (Some(ip), Some(mac)) = (find_ip(f[1]), normalise_mac(f[3])) { out.push((ip, mac)); }
            }
        }
    }

    #[cfg(windows)]
    {
        // Sections start with "Interface: 192.168.1.196 --- 0xd"; only read ours.
        let text = run("arp", &["-a"]);
        let mut in_ours = false;
        for line in text.lines() {
            let f: Vec<&str> = line.split_whitespace().collect();
            if f.first().map(|t| t.ends_with(':')).unwrap_or(false) && f.len() >= 2 {
                in_ours = find_ip(f[1]) == Some(local_ip);
                continue;
            }
            if in_ours && f.len() >= 2 {
                if let (Some(ip), Some(mac)) = (find_ip(f[0]), normalise_mac(f[1])) { out.push((ip, mac)); }
            }
        }
    }

    out
}
