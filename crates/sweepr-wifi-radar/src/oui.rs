//! Embedded IEEE manufacturer table (built by scripts/build-oui-table.mjs).
use std::collections::HashMap;
use std::io::Read;
use std::sync::OnceLock;

static TABLE_GZ: &[u8] = include_bytes!("../data/oui.tsv.gz");
static TABLE: OnceLock<HashMap<u32, String>> = OnceLock::new();

fn table() -> &'static HashMap<u32, String> {
    TABLE.get_or_init(|| {
        let mut text = String::new();
        let _ = flate2::read::GzDecoder::new(TABLE_GZ).read_to_string(&mut text);
        let mut map = HashMap::with_capacity(41_000);
        for line in text.lines() {
            if let Some((hex, name)) = line.split_once('\t') {
                if let Ok(k) = u32::from_str_radix(hex, 16) { map.insert(k, name.to_string()); }
            }
        }
        map
    })
}

/// "60:d8:a4:55:b8:35" -> Some("Vantiva") etc.
pub fn lookup(mac: &str) -> Option<String> {
    let hex: String = mac.chars().filter(|c| c.is_ascii_hexdigit()).take(6).collect();
    if hex.len() != 6 { return None; }
    let key = u32::from_str_radix(&hex, 16).ok()?;
    table().get(&key).cloned()
}

/// Tidies manufacturer strings reported by devices themselves (UPnP).
pub fn tidy_vendor(v: &str) -> String {
    let l = v.to_lowercase();
    for (needle, brand) in [("samsung", "Samsung"), ("lg electronics", "LG"), ("sony", "Sony"), ("roku", "Roku"), ("sonos", "Sonos"), ("amazon", "Amazon"), ("google", "Google"), ("apple", "Apple"), ("microsoft", "Microsoft"), ("philips", "Philips"), ("hewlett", "HP"), ("vizio", "Vizio"), ("hisense", "Hisense"), ("panasonic", "Panasonic"), ("sky", "Sky")] {
        if l.contains(needle) { return brand.into(); }
    }
    v.trim().chars().take(28).collect()
}
