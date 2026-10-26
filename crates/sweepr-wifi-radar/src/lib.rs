//! SWEEPR Wi-Fi Radar: finds every device on the home network and works out
//! what it is, in plain English.
//!
//! Techniques (all run in parallel, about 4 seconds in total, no admin rights needed):
//! 1. Sweep of the local /24 with NetBIOS status queries: fills the OS neighbour (ARP)
//!    table and returns Windows computer names.
//! 2. OS neighbour table: every device that is switched on (IP + hardware address).
//! 3. mDNS / Bonjour: service names (AirPlay, Google Cast, printers, speakers, HomeKit)
//!    plus reverse hostname lookups.
//! 4. SSDP / UPnP: "friendlyName", manufacturer and model from the device description.
//! 5. Reverse DNS through the router (DHCP host names).
//! 6. Embedded IEEE manufacturer table for the hardware address.

mod dns;
mod neighbours;
mod oui;
mod probes;

use serde::Serialize;
use std::collections::HashMap;
use std::net::Ipv4Addr;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeviceKind {
    Router,
    Extender,
    Windows,
    Macos,
    Linux,
    Iphone,
    Android,
    Computer,
    Tv,
    Speaker,
    Printer,
    Camera,
    Console,
    SmartHome,
    Private,
    Other,
}

#[derive(Debug, Clone, Serialize)]
pub struct Device {
    pub ip: String,
    pub mac: String,
    /// Best plain-English name, e.g. "Living Room TV" or "Bens MacBook Air".
    pub name: String,
    /// Manufacturer from the hardware address or UPnP description, e.g. "Samsung".
    pub vendor: Option<String>,
    pub model: Option<String>,
    pub kind: DeviceKind,
    /// One-line plain-English explanation shown under the name.
    pub detail: String,
    pub is_router: bool,
    pub is_self: bool,
    /// The device uses a randomised hardware address (a privacy setting).
    pub private_address: bool,
    /// The device is a TV brand that sends viewing data to advertisers by default.
    pub tracker_risk: bool,
    /// Which techniques identified this device (for support / debugging).
    pub sources: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ScanReport {
    pub local_ip: String,
    pub gateway_ip: Option<String>,
    pub network: String,
    pub scanned_at: u64,
    pub devices: Vec<Device>,
}

#[derive(Debug, Clone)]
pub struct ScanOptions {
    pub sweep_wait: Duration,
    pub discovery_wait: Duration,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self { sweep_wait: Duration::from_millis(1800), discovery_wait: Duration::from_millis(2200) }
    }
}

#[derive(Default, Debug, Clone)]
pub(crate) struct Hints {
    pub netbios: Option<String>,
    pub mdns_names: Vec<String>,
    pub mdns_services: Vec<String>,
    pub mdns_model: Option<String>,
    pub ssdp_name: Option<String>,
    pub ssdp_vendor: Option<String>,
    pub ssdp_model: Option<String>,
    pub ssdp_server: Option<String>,
    pub rdns: Option<String>,
}

pub(crate) struct LocalNet {
    pub ip: Ipv4Addr,
    pub prefix: u8,
    pub gateway: Option<Ipv4Addr>,
    pub mac: Option<String>,
}

impl LocalNet {
    /// Hosts to sweep. Large networks are limited to the /24 around this computer.
    pub fn hosts(&self) -> Vec<Ipv4Addr> {
        let prefix = self.prefix.max(24).min(30);
        let base = u32::from(self.ip) & (u32::MAX << (32 - prefix));
        let count = 1u32 << (32 - prefix);
        (1..count - 1).map(|i| Ipv4Addr::from(base + i)).filter(|a| *a != self.ip).collect()
    }
    pub fn contains(&self, a: Ipv4Addr) -> bool {
        let prefix = self.prefix.max(24).min(30);
        let mask = u32::MAX << (32 - prefix);
        let base = u32::from(self.ip) & mask;
        let v = u32::from(a);
        (v & mask) == base && v != base && v != (base | !mask)
    }
    pub fn cidr(&self) -> String {
        let prefix = self.prefix.max(24).min(30);
        let base = u32::from(self.ip) & (u32::MAX << (32 - prefix));
        format!("{}/{}", Ipv4Addr::from(base), prefix)
    }
}

fn is_tunnel_or_virtual_iface(name: &str, ip: Ipv4Addr) -> bool {
    let lower = name.to_ascii_lowercase();
    let octets = ip.octets();
    if ip.is_loopback() || (octets[0] == 10 && octets[1] == 64) || (octets[0] == 169 && octets[1] == 254) {
        return true;
    }
    lower.contains("sweepr")
        || lower.starts_with("utun")
        || lower.starts_with("wg")
        || lower.starts_with("tun")
        || lower.starts_with("tap")
        || lower.starts_with("loopback")
}

fn is_private_lan_ipv4(ip: Ipv4Addr) -> bool {
    let o = ip.octets();
    if o[0] == 10 && o[1] == 64 {
        return false; // Exclude CGNAT / WireGuard 10.64.0.0/16 mesh
    }
    (o[0] == 192 && o[1] == 168)
        || o[0] == 10
        || (o[0] == 172 && (16..=31).contains(&o[1]))
}

fn detect_local_net() -> Result<LocalNet, String> {
    if let Ok(iface) = netdev::get_default_interface() {
        if let Some(v4) = iface.ipv4.first() {
            let ip = v4.addr();
            if !is_tunnel_or_virtual_iface(&iface.name, ip) && is_private_lan_ipv4(ip) {
                let gateway = iface.gateway.as_ref().and_then(|g| g.ipv4.first().copied());
                let mac = iface.mac_addr.and_then(|m| neighbours::normalise_mac(&m.to_string()));
                return Ok(LocalNet { ip, prefix: v4.prefix_len(), gateway, mac });
            }
        }
    }

    // Iterate physical interfaces to find active LAN IPv4 interface even when VPN tunnel is active
    for iface in netdev::get_interfaces() {
        if iface.is_loopback() {
            continue;
        }
        for v4 in &iface.ipv4 {
            let ip = v4.addr();
            if !is_tunnel_or_virtual_iface(&iface.name, ip) && is_private_lan_ipv4(ip) {
                let gateway = iface.gateway.as_ref().and_then(|g| g.ipv4.first().copied());
                let mac = iface.mac_addr.and_then(|m| neighbours::normalise_mac(&m.to_string()));
                return Ok(LocalNet { ip, prefix: v4.prefix_len(), gateway, mac });
            }
        }
    }

    // Fallback: find the outgoing address without sending anything.
    let sock = std::net::UdpSocket::bind("0.0.0.0:0").map_err(|e| e.to_string())?;
    sock.connect("1.1.1.1:80").map_err(|e| e.to_string())?;
    match sock.local_addr().map_err(|e| e.to_string())?.ip() {
        std::net::IpAddr::V4(ip) => Ok(LocalNet { ip, prefix: 24, gateway: None, mac: None }),
        _ => Err("No IPv4 home network found".into()),
    }
}

/// Scan the home network. Blocking; takes about 4 seconds.
pub fn scan_network(opts: ScanOptions) -> Result<ScanReport, String> {
    let net = detect_local_net()?;
    let hosts = net.hosts();

    // Phase A (parallel): sweep + NetBIOS, SSDP, mDNS services.
    let sweep_hosts = hosts.clone();
    let sweep_wait = opts.sweep_wait;
    let t_sweep = std::thread::spawn(move || probes::netbios_sweep(&sweep_hosts, sweep_wait));
    let disc = opts.discovery_wait;
    let t_ssdp = std::thread::spawn(move || probes::ssdp_discover(disc));
    let t_mdns = std::thread::spawn(move || probes::mdns_services(disc));

    let netbios = t_sweep.join().unwrap_or_default();

    // Phase B: read the neighbour table now that the sweep has filled it.
    let mut table: Vec<(Ipv4Addr, String)> = neighbours::read_table(net.ip)
        .into_iter()
        .filter(|(ip, _)| net.contains(*ip))
        .collect();
    table.sort_by_key(|(ip, _)| u32::from(*ip));
    table.dedup_by_key(|(ip, _)| *ip);

    let ips: Vec<Ipv4Addr> = table.iter().map(|(ip, _)| *ip).collect();
    let t_rptr = { let ips = ips.clone(); std::thread::spawn(move || probes::mdns_reverse(&ips, Duration::from_millis(1200))) };
    let rdns = probes::reverse_dns(&ips, Duration::from_millis(1200));

    let ssdp = t_ssdp.join().unwrap_or_default();
    let mdns = t_mdns.join().unwrap_or_default();
    let rptr = t_rptr.join().unwrap_or_default();

    // Merge every hint per IP.
    let mut hints: HashMap<Ipv4Addr, Hints> = HashMap::new();
    for (ip, n) in netbios { hints.entry(ip).or_default().netbios = Some(n); }
    for (ip, h) in mdns { let e = hints.entry(ip).or_default(); e.mdns_names.extend(h.names); e.mdns_services.extend(h.services); if e.mdns_model.is_none() { e.mdns_model = h.model; } }
    for (ip, names) in rptr { hints.entry(ip).or_default().mdns_names.extend(names); }
    for (ip, s) in ssdp { let e = hints.entry(ip).or_default(); e.ssdp_name = s.friendly_name; e.ssdp_vendor = s.manufacturer; e.ssdp_model = s.model; e.ssdp_server = s.server; }
    for (ip, n) in rdns { hints.entry(ip).or_default().rdns = Some(n); }

    let mut devices: Vec<Device> = Vec::new();

    // This computer first.
    let self_name = dns_lookup::get_hostname().ok().map(|h| pretty_host(&h)).filter(|s| !s.is_empty());
    let (self_os_name, self_os_kind) = if cfg!(target_os = "macos") {
        ("macOS Desktop", DeviceKind::Macos)
    } else if cfg!(target_os = "linux") {
        ("Linux Desktop", DeviceKind::Linux)
    } else {
        ("Windows Desktop", DeviceKind::Windows)
    };
    devices.push(Device {
        ip: net.ip.to_string(),
        mac: net.mac.clone().unwrap_or_default(),
        name: self_os_name.into(),
        vendor: net.mac.as_deref().and_then(oui::lookup),
        model: None,
        kind: self_os_kind,
        detail: match &self_name { Some(n) => format!("{n} · protected by SWEEPR"), None => "Protected by SWEEPR".into() },
        is_router: false,
        is_self: true,
        private_address: false,
        tracker_risk: false,
        sources: vec!["self".into()],
    });

    let mut mac_count: HashMap<String, usize> = HashMap::new();
    for (_, mac) in &table { *mac_count.entry(mac.clone()).or_default() += 1; }
    for (ip, mac) in table {
        let h = hints.remove(&ip).unwrap_or_default();
        let shared = mac_count.get(&mac).copied().unwrap_or(0) > 1;
        devices.push(build_device(ip, &mac, &h, net.gateway == Some(ip), shared));
    }

    // Give identical names a number: "Amazon Echo", "Amazon Echo 2", ...
    let mut seen: HashMap<String, usize> = HashMap::new();
    for d in devices.iter_mut() {
        let n = seen.entry(d.name.clone()).or_insert(0);
        *n += 1;
        if *n > 1 { d.name = format!("{} {}", d.name, n); }
    }

    // Router first after this computer, then TVs with tracking, then by name.
    devices.sort_by(|a, b| {
        let rank = |d: &Device| if d.is_self { 0 } else if d.is_router || d.kind == DeviceKind::Extender { 1 } else if d.tracker_risk { 2 } else if d.kind == DeviceKind::Private { 4 } else { 3 };
        rank(a).cmp(&rank(b)).then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(ScanReport {
        local_ip: net.ip.to_string(),
        gateway_ip: net.gateway.map(|g| g.to_string()),
        network: net.cidr(),
        scanned_at: SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0),
        devices,
    })
}

fn build_device(ip: Ipv4Addr, mac: &str, h: &Hints, is_router: bool, shared_mac: bool) -> Device {
    // A hardware address shared by several devices belongs to a Wi-Fi extender relaying for them.
    let private_address = !shared_mac && neighbours::is_locally_administered(mac);
    let oui_vendor = if private_address || shared_mac { None } else { oui::lookup(mac) };
    let vendor = h.ssdp_vendor.clone().map(|v| oui::tidy_vendor(&v)).or(oui_vendor);
    let model = h.ssdp_model.clone().or(h.mdns_model.clone());
    let mut sources = Vec::new();

    // Name priority: UPnP friendly name > mDNS service name > mDNS host > NetBIOS > router DNS.
    let mut name: Option<String> = None;
    if let Some(n) = h.ssdp_name.as_deref().map(clean_friendly).map(|n| strip_hex_prefix(&n)).filter(|n| useful_name(n)) { name = Some(n); sources.push("upnp".into()); }
    if name.is_none() {
        if let Some(n) = h.mdns_names.iter().map(|n| strip_hex_prefix(&pretty_host(n))).find(|n| useful_name(n)) { name = Some(n); sources.push("mdns".into()); }
    }
    if name.is_none() {
        if let Some(n) = h.netbios.as_deref().map(pretty_host).map(|n| strip_hex_prefix(&n)).filter(|n| useful_name(n)) { name = Some(n); sources.push("netbios".into()); }
    }
    if name.is_none() {
        if let Some(n) = h.rdns.as_deref().map(pretty_host).map(|n| strip_hex_prefix(&n)).filter(|n| useful_name(n)) { name = Some(n); sources.push("router-dns".into()); }
    }
    // A brand in the device's own name beats the maker of its Wi-Fi chip ("Brother" not "Foxconn").
    let vendor = name.as_deref().and_then(brand_in_name).or(vendor);
    if vendor.is_some() { sources.push("manufacturer".into()); }

    let haystack = format!(
        "{} {} {} {} {} {}",
        name.clone().unwrap_or_default(),
        vendor.clone().unwrap_or_default(),
        model.clone().unwrap_or_default(),
        h.ssdp_server.clone().unwrap_or_default(),
        h.mdns_services.join(" "),
        h.mdns_names.join(" ")
    )
    .to_lowercase();

        let kind = if is_router { DeviceKind::Router }
        else if EXTENDER_WORDS.iter().any(|w| haystack.contains(w)) || (shared_mac && name.as_deref().map(|n| n.to_lowercase().starts_with("re")).unwrap_or(false)) { DeviceKind::Extender }
        else { classify(&haystack, mac, h.netbios.is_some(), private_address && name.is_none()) };
    // Amazon speakers announce themselves only as "SpotifyConnect": call them what they are.
    let name = if name.is_none() && kind == DeviceKind::Speaker && vendor.as_deref() == Some("Amazon") { Some("Amazon Echo".to_string()) } else { name };
    let tracker_risk = kind == DeviceKind::Tv && ACR_BRANDS.iter().any(|b| haystack.contains(b));

    let display_name = match (&name, is_router) {
        (_, true) => "Home Wi-Fi Router".to_string(),
        (Some(n), _) => n.clone(),
        (None, _) => match (&kind, &vendor) {
            (DeviceKind::Windows, _) => "Windows Desktop".into(),
            (DeviceKind::Macos, _) => "macOS Desktop".into(),
            (DeviceKind::Linux, _) => "Linux Desktop".into(),
            (DeviceKind::Iphone, _) => "iPhone".into(),
            (DeviceKind::Android, _) => "Android Mobile Device".into(),
            (DeviceKind::Private, _) => "iPhone".into(),
            (k, Some(v)) => format!("{v} {}", kind_noun(k)),
            (k, None) => kind_label(k).into(),
        },
    };

    let made_by = vendor.as_ref().map(|v| format!("Made by {v}"));
    let detail = if is_router {
        match &vendor { Some(v) => format!("Your home internet box · Made by {v}"), None => "Your home internet box".into() }
    } else if tracker_risk {
        format!("{} TV · sends what you watch to advertisers", vendor.clone().unwrap_or_else(|| "Smart".into()))
    } else if kind == DeviceKind::Extender {
        "Wi-Fi extender · boosts your signal to other rooms".into()
    } else if kind == DeviceKind::Private {
        "Hides its identity on purpose (a privacy setting)".into()
    } else {
        let mut parts: Vec<String> = Vec::new();
        if name.is_some() { parts.push(kind_label(&kind).into()); }
        if let Some(m) = &made_by { parts.push(m.clone()); }
        if let Some(m) = &model { if !display_name.contains(m.as_str()) && m.len() < 40 { parts.push(m.clone()); } }
        if parts.is_empty() { "Couldn't identify this device".into() } else { parts.join(" · ") }
    };

    Device { ip: ip.to_string(), mac: mac.to_string(), name: display_name, vendor, model, kind, detail, is_router, is_self: false, private_address, tracker_risk, sources }
}

const EXTENDER_WORDS: &[&str] = &["extender", "repeater", "re220", "re200", "re305", "re450", "re650", "deco", "eero", "orbi", "velop", "mesh", "powerline", "wifi booster", "super wifi"];

const GENERIC_NAMES: &[&str] = &["none", "null", "n/a", "na", "undefined", "mysimplelink", "spotifyconnect", "localhost", "android", "espressif", "esp", "unknown", "device", "home", "linux", "default", "wlan0", "client"];

const BRANDS: &[(&str, &str)] = &[("brother", "Brother"), ("samsung", "Samsung"), ("lg ", "LG"), ("sony", "Sony"), ("bravia", "Sony"), ("roku", "Roku"), ("sonos", "Sonos"), ("firetv", "Amazon"), ("fire tv", "Amazon"), ("echo", "Amazon"), ("kindle", "Amazon"), ("ring", "Ring"), ("chromecast", "Google"), ("nest", "Google"), ("macbook", "Apple"), ("imac", "Apple"), ("apple tv", "Apple"), ("homepod", "Apple"), ("epson", "Epson"), ("canon", "Canon"), ("hp ", "HP"), ("xbox", "Microsoft"), ("playstation", "Sony"), ("nintendo", "Nintendo"), ("philips", "Philips"), ("hue", "Philips Hue")];

fn brand_in_name(n: &str) -> Option<String> {
    let l = format!("{} ", n.to_lowercase());
    BRANDS.iter().find(|(k, _)| l.contains(k)).map(|(_, b)| b.to_string())
}

/// "343EA45BC55F mysimplelink" -> "mysimplelink" (devices often put their address in front).
fn strip_hex_prefix(n: &str) -> String {
    let mut parts = n.split_whitespace();
    match parts.next() {
        Some(first) if first.len() >= 8 && first.chars().all(|c| c.is_ascii_hexdigit()) => parts.collect::<Vec<_>>().join(" "),
        _ => n.to_string(),
    }
}

const ACR_BRANDS: &[&str] = &["samsung", "lg", "webos", "vizio", "roku", "hisense", "tcl", "tizen"];

fn classify(s: &str, mac: &str, has_netbios: bool, anonymous_private: bool) -> DeviceKind {
    let has = |words: &[&str]| words.iter().any(|w| s.contains(w));
    if has(&["tv", "bravia", "webos", "tizen", "roku", "fire tv", "firetv", "chromecast", "googlecast", "apple tv", "appletv", "shield", "vizio", "hisense", "tcl", "freeview", "sky q", "youview", "mediarenderer", "dial-multiscreen"]) { return DeviceKind::Tv; }
    if has(&["xbox", "playstation", "ps4", "ps5", "nintendo", "steam deck"]) { return DeviceKind::Console; }
    if has(&["printer", "_ipp", "_pdl", "laserjet", "officejet", "deskjet", "envy", "epson", "brother", "canon", "kyocera", "xerox"]) { return DeviceKind::Printer; }
    if has(&["sonos", "echo", "alexa", "homepod", "google home", "nest audio", "nest mini", "bose", "spotify", "_raop", "speaker", "soundbar", "denon", "yamaha", "bang & olufsen"]) { return DeviceKind::Speaker; }
    if has(&["camera", "cam ", "ring", "arlo", "wyze", "hikvision", "doorbell", "reolink", "eufy", "blink"]) { return DeviceKind::Camera; }
    if has(&["hue", "philips hue", "_hap", "homekit", "tuya", "shelly", "espressif", "kasa", "tapo", "smartthings", "nest", "thermostat", "plug", "bulb", "hive", "tado", "meross", "switchbot"]) { return DeviceKind::SmartHome; }
    if has(&["macbook", "imac", "mac mini", "mac-mini", "mac studio", "mac pro", "macos", "_afpovertcp", "_adisk"]) { return DeviceKind::Macos; }
    if has(&["iphone", "ipad", "ios", "_companion-link", "_airplay"]) { return DeviceKind::Iphone; }
    if has(&["android", "galaxy", "pixel", "xiaomi", "redmi", "oneplus", "motorola", "huawei", "oppo", "vivo"]) { return DeviceKind::Android; }
    if has_netbios || has(&["desktop", "laptop", "pc", "windows", "_smb", "_workstation", "dell", "lenovo", "asus", "acer", "hp ", "surface", "intel", "thinkpad", "realtek", "mediatek", "micro-star", "msi", "gigabyte"]) { return DeviceKind::Windows; }
    if has(&["apple"]) { return DeviceKind::Iphone; }
    if anonymous_private {
        let nibble = mac.chars().nth(1).map(|c| c.to_ascii_uppercase()).unwrap_or('2');
        return if nibble == 'A' || nibble == 'E' { DeviceKind::Android } else { DeviceKind::Iphone };
    }
    DeviceKind::Windows
}

fn kind_noun(k: &DeviceKind) -> &'static str {
    match k { DeviceKind::Router => "Router", DeviceKind::Extender => "Wi-Fi Extender", DeviceKind::Windows => "Desktop", DeviceKind::Macos => "Desktop", DeviceKind::Linux => "Desktop", DeviceKind::Iphone => "iPhone", DeviceKind::Android => "Mobile Device", DeviceKind::Computer => "Desktop", DeviceKind::Tv => "Smart TV", DeviceKind::Speaker => "Speaker", DeviceKind::Printer => "Printer", DeviceKind::Camera => "Camera", DeviceKind::Console => "Games Console", DeviceKind::SmartHome => "Smart Home Device", DeviceKind::Private => "Mobile Device", DeviceKind::Other => "Desktop" }
}
fn kind_label(k: &DeviceKind) -> &'static str {
    match k { DeviceKind::Router => "Home Wi-Fi Router", DeviceKind::Extender => "Wi-Fi Extender", DeviceKind::Windows => "Windows Desktop", DeviceKind::Macos => "macOS Desktop", DeviceKind::Linux => "Linux Desktop", DeviceKind::Iphone => "iPhone", DeviceKind::Android => "Android Mobile Device", DeviceKind::Computer => "Windows Desktop", DeviceKind::Tv => "Smart TV", DeviceKind::Speaker => "Speaker", DeviceKind::Printer => "Printer", DeviceKind::Camera => "Camera", DeviceKind::Console => "Games Console", DeviceKind::SmartHome => "Smart Home Device", DeviceKind::Private => "iPhone", DeviceKind::Other => "Windows Desktop" }
}

fn useful_name(n: &str) -> bool {
    let l = n.to_lowercase();
    !n.is_empty()
        && n.len() <= 48
        && !l.parse::<Ipv4Addr>().is_ok()
        && !l.starts_with("unknown")
        && !GENERIC_NAMES.iter().any(|g| l == *g || l.trim_end_matches(|c: char| c.is_ascii_digit() || c == ' ' || c == '#') == *g)
        && !l.contains("in-addr")
        && !(l.len() >= 12 && l.chars().all(|c| c.is_ascii_hexdigit() || c == '-' || c == ':' || c == ' '))
}

/// "Bens-MacBook-Air.local" -> "Bens MacBook Air"; "android-3f2a.lan" kept short.
pub(crate) fn pretty_host(h: &str) -> String {
    let mut s = h.trim().trim_end_matches('.').to_string();
    for suf in [".local", ".lan", ".home", ".localdomain", ".domain", ".router", ".gateway", ".box", ".station", ".broadband", ".bthomehub", ".home.arpa", ".fritz.box", ".sky", ".virginmedia.com"] {
        if s.to_lowercase().ends_with(suf) { let n = s.len() - suf.len(); s.truncate(n); }
    }
    // Only cut at the first dot for host names, not friendly names like "Mr. Smith's TV".
    if !s.contains(' ') { if let Some(i) = s.find('.') { s.truncate(i); } }
    let s = s.replace(['-', '_'], " ");
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn clean_friendly(n: &str) -> String {
    let n = dns::xml_unescape(n.trim());
    // "[TV] Samsung 7 Series (55)" -> "Samsung 7 Series (55)"
    let n = n.trim_start_matches("[TV]").trim_start_matches("[AV]").trim();
    n.chars().take(48).collect()
}
