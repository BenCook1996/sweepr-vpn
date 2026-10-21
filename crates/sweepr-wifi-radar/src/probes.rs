//! Network probes used by the scanner. All are passive or standard discovery
//! messages that home devices answer by design; none need admin rights.
use crate::dns;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::net::{IpAddr, Ipv4Addr, SocketAddr, TcpStream, UdpSocket};
use std::sync::mpsc;
use std::time::{Duration, Instant};

fn recv_until<F: FnMut(&[u8], Ipv4Addr)>(sock: &UdpSocket, deadline: Instant, mut f: F) {
    let mut buf = [0u8; 9000];
    loop {
        let now = Instant::now();
        if now >= deadline { break; }
        let _ = sock.set_read_timeout(Some((deadline - now).max(Duration::from_millis(5))));
        match sock.recv_from(&mut buf) {
            Ok((n, SocketAddr::V4(src))) => f(&buf[..n], *src.ip()),
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock || e.kind() == std::io::ErrorKind::TimedOut => break,
            Err(_) => {} // e.g. Windows "connection reset" from closed ports: keep listening
        }
    }
}

// ---------------------------------------------------------------- NetBIOS sweep
/// Sends a NetBIOS "node status" request to every host. This also makes the OS
/// learn every live device's hardware address (filling the ARP table).
pub fn netbios_sweep(hosts: &[Ipv4Addr], wait: Duration) -> Vec<(Ipv4Addr, String)> {
    let Ok(sock) = UdpSocket::bind("0.0.0.0:0") else { return vec![] };
    let mut q = vec![0x53, 0x57, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x20, b'C', b'K'];
    q.extend(std::iter::repeat(b'A').take(30));
    q.extend_from_slice(&[0x00, 0x00, 0x21, 0x00, 0x01]);
    for (i, h) in hosts.iter().enumerate() {
        let _ = sock.send_to(&q, (*h, 137));
        if i % 32 == 31 { std::thread::sleep(Duration::from_millis(2)); }
    }
    let mut out = HashMap::new();
    recv_until(&sock, Instant::now() + wait, |msg, src| {
        if let Some(name) = parse_nbstat(msg) { out.insert(src, name); }
    });
    out.into_iter().collect()
}

fn parse_nbstat(msg: &[u8]) -> Option<String> {
    let (_, p) = dns::read_name(msg, 12)?;
    let start = p + 10; // type, class, ttl, rdlength
    let count = *msg.get(start)? as usize;
    for i in 0..count {
        let e = start + 1 + i * 18;
        let entry = msg.get(e..e + 18)?;
        let suffix = entry[15];
        let flags = u16::from_be_bytes([entry[16], entry[17]]);
        if suffix == 0x00 && flags & 0x8000 == 0 {
            let name = String::from_utf8_lossy(&entry[..15]).trim().to_string();
            if !name.is_empty() { return Some(name); }
        }
    }
    None
}

// ---------------------------------------------------------------- SSDP / UPnP
#[derive(Debug, Default, Clone)]
pub struct SsdpInfo {
    pub friendly_name: Option<String>,
    pub manufacturer: Option<String>,
    pub model: Option<String>,
    pub server: Option<String>,
}

pub fn ssdp_discover(wait: Duration) -> Vec<(Ipv4Addr, SsdpInfo)> {
    let Ok(sock) = UdpSocket::bind("0.0.0.0:0") else { return vec![] };
    let _ = sock.set_multicast_ttl_v4(2);
    for st in ["ssdp:all", "upnp:rootdevice", "urn:dial-multiscreen-org:service:dial:1"] {
        let msg = format!("M-SEARCH * HTTP/1.1\r\nHOST: 239.255.255.250:1900\r\nMAN: \"ssdp:discover\"\r\nMX: 1\r\nST: {st}\r\nUSER-AGENT: SWEEPR/1.0 UPnP/1.1\r\n\r\n");
        let _ = sock.send_to(msg.as_bytes(), (Ipv4Addr::new(239, 255, 255, 250), 1900));
    }
    let mut locations: HashMap<Ipv4Addr, (Vec<String>, Option<String>)> = HashMap::new();
    recv_until(&sock, Instant::now() + wait, |msg, src| {
        let text = String::from_utf8_lossy(msg);
        let e = locations.entry(src).or_insert_with(|| (Vec::new(), None));
        for line in text.lines() {
            if let Some((k, v)) = line.split_once(':') {
                match k.trim().to_ascii_lowercase().as_str() {
                    "location" => { let v = v.trim().to_string(); if !e.0.contains(&v) { e.0.push(v); } }
                    "server" => { e.1.get_or_insert_with(|| v.trim().to_string()); }
                    _ => {}
                }
            }
        }
    });

    // Fetch each device's description in parallel (first location that answers).
    let (tx, rx) = mpsc::channel();
    for (ip, (locs, server)) in locations {
        let tx = tx.clone();
        std::thread::spawn(move || {
            let mut info = SsdpInfo { server, ..Default::default() };
            for loc in locs.iter().take(3) {
                if let Some(xml) = http_get(loc, Duration::from_millis(1500)) {
                    info.friendly_name = xml_tag(&xml, "friendlyName");
                    info.manufacturer = xml_tag(&xml, "manufacturer");
                    info.model = xml_tag(&xml, "modelName");
                    if info.friendly_name.is_some() { break; }
                }
            }
            let _ = tx.send((ip, info));
        });
    }
    drop(tx);
    let deadline = Instant::now() + Duration::from_millis(1800);
    let mut out = Vec::new();
    while let Ok(item) = rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) { out.push(item); }
    out
}

fn http_get(url: &str, timeout: Duration) -> Option<String> {
    let rest = url.strip_prefix("http://")?;
    let (hostport, path) = match rest.find('/') { Some(i) => (&rest[..i], &rest[i..]), None => (rest, "/") };
    let addr: SocketAddr = if hostport.contains(':') { hostport.parse().ok()? } else { format!("{hostport}:80").parse().ok()? };
    // Only talk to devices on the local network.
    match addr.ip() { IpAddr::V4(v4) if v4.is_private() || v4.is_link_local() => {}, _ => return None }
    let mut s = TcpStream::connect_timeout(&addr, timeout).ok()?;
    let _ = s.set_read_timeout(Some(timeout));
    let _ = s.set_write_timeout(Some(timeout));
    let req = format!("GET {path} HTTP/1.0\r\nHost: {hostport}\r\nUser-Agent: SWEEPR/1.0\r\nConnection: close\r\n\r\n");
    s.write_all(req.as_bytes()).ok()?;
    let mut buf = Vec::new();
    let _ = s.take(256 * 1024).read_to_end(&mut buf);
    if buf.is_empty() { return None; }
    Some(String::from_utf8_lossy(&buf).into_owned())
}

fn xml_tag(xml: &str, tag: &str) -> Option<String> {
    let lower = xml.to_lowercase();
    let open = format!("<{}>", tag.to_lowercase());
    let close = format!("</{}>", tag.to_lowercase());
    let s = lower.find(&open)? + open.len();
    let e = s + lower[s..].find(&close)?;
    let v = dns::xml_unescape(xml[s..e].trim());
    if v.is_empty() { None } else { Some(v) }
}

// ---------------------------------------------------------------- mDNS / Bonjour
#[derive(Debug, Default, Clone)]
pub struct MdnsInfo {
    pub names: Vec<String>,
    pub services: Vec<String>,
    pub model: Option<String>,
}

const SERVICES: &[&str] = &[
    "_googlecast._tcp.local", "_airplay._tcp.local", "_raop._tcp.local", "_spotify-connect._tcp.local",
    "_ipp._tcp.local", "_printer._tcp.local", "_pdl-datastream._tcp.local", "_hap._tcp.local",
    "_sonos._tcp.local", "_amzn-wplay._tcp.local", "_androidtvremote2._tcp.local", "_viziocast._tcp.local",
    "_device-info._tcp.local", "_companion-link._tcp.local", "_smb._tcp.local", "_workstation._tcp.local",
    "_hue._tcp.local", "_matter._tcp.local", "_nvstream._tcp.local", "_xbox._tcp.local",
];

fn mdns_socket() -> Option<UdpSocket> {
    let sock = UdpSocket::bind("0.0.0.0:0").ok()?;
    let _ = sock.set_multicast_ttl_v4(255);
    Some(sock)
}

const MDNS: (Ipv4Addr, u16) = (Ipv4Addr::new(224, 0, 0, 251), 5353);

pub fn mdns_services(wait: Duration) -> Vec<(Ipv4Addr, MdnsInfo)> {
    let Some(sock) = mdns_socket() else { return vec![] };
    for _round in 0..2 {
        for chunk in SERVICES.chunks(5) {
            let qs: Vec<(&str, u16)> = chunk.iter().map(|s| (*s, dns::T_PTR)).collect();
            let _ = sock.send_to(&dns::build_query(0, &qs, true), MDNS);
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    let mut out: HashMap<Ipv4Addr, MdnsInfo> = HashMap::new();
    recv_until(&sock, Instant::now() + wait, |msg, src| {
        let recs = dns::parse_records(msg);
        let mut hosts: HashMap<String, Ipv4Addr> = HashMap::new();
        let mut srv: HashMap<String, String> = HashMap::new();
        let mut txt: HashMap<String, Vec<String>> = HashMap::new();
        let mut ptrs: Vec<(String, String)> = Vec::new();
        for r in &recs {
            match &r.data {
                dns::RData::A(ip) => { hosts.insert(r.name.to_lowercase(), *ip); }
                dns::RData::Srv(t) => { srv.insert(r.name.to_lowercase(), t.clone()); }
                dns::RData::Txt(items) => { txt.insert(r.name.to_lowercase(), items.clone()); }
                dns::RData::Ptr(target) if r.name.starts_with('_') => ptrs.push((r.name.clone(), target.clone())),
                _ => {}
            }
        }
        for (service, instance) in ptrs {
            let key = instance.to_lowercase();
            let target = srv.get(&key).cloned();
            let ip = target.as_ref().and_then(|t| hosts.get(&t.to_lowercase()).copied()).unwrap_or(src);
            let e = out.entry(ip).or_default();
            let svc = service.trim_end_matches(".local").to_string();
            if !e.services.contains(&svc) { e.services.push(svc); }
            let items = txt.get(&key).cloned().unwrap_or_default();
            for it in &items {
                if let Some(v) = it.strip_prefix("fn=") { if !v.is_empty() { e.names.insert(0, v.to_string()); } }
                if let Some(v) = it.strip_prefix("md=").or_else(|| it.strip_prefix("model=")) { if e.model.is_none() && !v.is_empty() { e.model = Some(v.to_string()); } }
            }
            // Instance label: "Living Room._airplay._tcp.local" -> "Living Room"
            let suffix = format!(".{}", service);
            let mut label = instance.strip_suffix(&suffix).unwrap_or(&instance).to_string();
            label = dns::unescape_instance(&label);
            if let Some(at) = label.find('@') { label = label[at + 1..].to_string(); } // raop "MAC@Name"
            if !service.starts_with("_device-info") && !label.is_empty() && !e.names.contains(&label) { e.names.push(label); }
            if let Some(t) = target { if !e.names.contains(&t) { e.names.push(t); } }
        }
        // device-info TXT carries the model even without a PTR for it
        for (name, items) in &txt {
            if name.contains("_device-info") {
                let e = out.entry(src).or_default();
                for it in items { if let Some(v) = it.strip_prefix("model=") { e.model.get_or_insert_with(|| v.to_string()); } }
            }
        }
    });
    out.into_iter().collect()
}

/// Asks each device for its own Bonjour host name ("Bens-MacBook-Air.local").
pub fn mdns_reverse(ips: &[Ipv4Addr], wait: Duration) -> Vec<(Ipv4Addr, Vec<String>)> {
    let Some(sock) = mdns_socket() else { return vec![] };
    let names: Vec<String> = ips.iter().map(|ip| { let o = ip.octets(); format!("{}.{}.{}.{}.in-addr.arpa", o[3], o[2], o[1], o[0]) }).collect();
    for chunk in names.chunks(12) {
        let qs: Vec<(&str, u16)> = chunk.iter().map(|n| (n.as_str(), dns::T_PTR)).collect();
        let _ = sock.send_to(&dns::build_query(0, &qs, true), MDNS);
    }
    let mut out: HashMap<Ipv4Addr, Vec<String>> = HashMap::new();
    recv_until(&sock, Instant::now() + wait, |msg, src| {
        for r in dns::parse_records(msg) {
            if let dns::RData::Ptr(host) = r.data {
                if r.name.ends_with("in-addr.arpa") {
                    let p: Vec<u8> = r.name.split('.').take(4).filter_map(|x| x.parse().ok()).collect();
                    let ip = if p.len() == 4 { Ipv4Addr::new(p[3], p[2], p[1], p[0]) } else { src };
                    let e = out.entry(ip).or_default();
                    if !e.contains(&host) { e.push(host); }
                }
            }
        }
    });
    out.into_iter().collect()
}

// ---------------------------------------------------------------- Reverse DNS
/// Asks the router for the name each device gave it when it joined (DHCP host name).
pub fn reverse_dns(ips: &[Ipv4Addr], wait: Duration) -> Vec<(Ipv4Addr, String)> {
    let (tx, rx) = mpsc::channel();
    for ip in ips.iter().copied() {
        let tx = tx.clone();
        std::thread::spawn(move || {
            if let Ok(name) = dns_lookup::lookup_addr(&IpAddr::V4(ip)) {
                if name.parse::<IpAddr>().is_err() && !name.is_empty() { let _ = tx.send((ip, name)); }
            }
        });
    }
    drop(tx);
    let deadline = Instant::now() + wait;
    let mut out = Vec::new();
    while let Ok(item) = rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) { out.push(item); }
    out
}
