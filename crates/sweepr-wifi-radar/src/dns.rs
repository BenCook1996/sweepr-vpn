//! Tiny DNS / mDNS message builder and parser (no external dependencies).

pub const T_A: u16 = 1;
pub const T_PTR: u16 = 12;
pub const T_TXT: u16 = 16;
pub const T_SRV: u16 = 33;

pub fn encode_name(name: &str, out: &mut Vec<u8>) {
    for label in name.trim_end_matches('.').split('.') {
        let b = label.as_bytes();
        out.push(b.len().min(63) as u8);
        out.extend_from_slice(&b[..b.len().min(63)]);
    }
    out.push(0);
}

/// Builds a query. `unicast_response` sets the mDNS "QU" bit so devices answer us directly.
pub fn build_query(id: u16, questions: &[(&str, u16)], unicast_response: bool) -> Vec<u8> {
    let mut m = Vec::with_capacity(64);
    m.extend_from_slice(&id.to_be_bytes());
    m.extend_from_slice(&0u16.to_be_bytes()); // flags: standard query
    m.extend_from_slice(&(questions.len() as u16).to_be_bytes());
    m.extend_from_slice(&[0, 0, 0, 0, 0, 0]);
    for (name, qtype) in questions {
        encode_name(name, &mut m);
        m.extend_from_slice(&qtype.to_be_bytes());
        let class: u16 = if unicast_response { 0x8001 } else { 0x0001 };
        m.extend_from_slice(&class.to_be_bytes());
    }
    m
}

/// Reads a (possibly compressed) name starting at `pos`. Returns (name, position after name).
pub fn read_name(msg: &[u8], mut pos: usize) -> Option<(String, usize)> {
    let mut labels: Vec<String> = Vec::new();
    let mut jumped = false;
    let mut end = 0usize;
    let mut hops = 0;
    loop {
        let len = *msg.get(pos)? as usize;
        if len == 0 {
            if !jumped { end = pos + 1; }
            break;
        }
        if len & 0xC0 == 0xC0 {
            let ptr = ((len & 0x3F) << 8) | *msg.get(pos + 1)? as usize;
            if !jumped { end = pos + 2; }
            jumped = true;
            pos = ptr;
            hops += 1;
            if hops > 20 { return None; }
            continue;
        }
        let label = msg.get(pos + 1..pos + 1 + len)?;
        labels.push(String::from_utf8_lossy(label).into_owned());
        pos += 1 + len;
    }
    Some((labels.join("."), end))
}

#[derive(Debug, Clone)]
pub struct Record {
    pub name: String,
    pub rtype: u16,
    pub data: RData,
}

#[derive(Debug, Clone)]
pub enum RData {
    A(std::net::Ipv4Addr),
    Ptr(String),
    Srv(String),
    Txt(Vec<String>),
    Other,
}

/// Parses every answer, authority and additional record in a message.
pub fn parse_records(msg: &[u8]) -> Vec<Record> {
    let mut out = Vec::new();
    if msg.len() < 12 { return out; }
    let qd = u16::from_be_bytes([msg[4], msg[5]]) as usize;
    let rr = u16::from_be_bytes([msg[6], msg[7]]) as usize + u16::from_be_bytes([msg[8], msg[9]]) as usize + u16::from_be_bytes([msg[10], msg[11]]) as usize;
    let mut pos = 12;
    for _ in 0..qd {
        match read_name(msg, pos) { Some((_, p)) => pos = p + 4, None => return out }
    }
    for _ in 0..rr {
        let Some((name, p)) = read_name(msg, pos) else { break };
        if p + 10 > msg.len() { break; }
        let rtype = u16::from_be_bytes([msg[p], msg[p + 1]]);
        let rdlen = u16::from_be_bytes([msg[p + 8], msg[p + 9]]) as usize;
        let rd = p + 10;
        if rd + rdlen > msg.len() { break; }
        let data = match rtype {
            T_A if rdlen == 4 => RData::A(std::net::Ipv4Addr::new(msg[rd], msg[rd + 1], msg[rd + 2], msg[rd + 3])),
            T_PTR => read_name(msg, rd).map(|(n, _)| RData::Ptr(n)).unwrap_or(RData::Other),
            T_SRV if rdlen > 6 => read_name(msg, rd + 6).map(|(n, _)| RData::Srv(n)).unwrap_or(RData::Other),
            T_TXT => {
                let mut items = Vec::new();
                let mut i = rd;
                while i < rd + rdlen {
                    let l = msg[i] as usize;
                    if i + 1 + l > rd + rdlen { break; }
                    items.push(String::from_utf8_lossy(&msg[i + 1..i + 1 + l]).into_owned());
                    i += 1 + l;
                }
                RData::Txt(items)
            }
            _ => RData::Other,
        };
        out.push(Record { name, rtype, data });
        pos = rd + rdlen;
    }
    out
}

/// Unescapes DNS-SD instance names: "Living\032Room" -> "Living Room".
pub fn unescape_instance(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'\\' && i + 3 < b.len() + 0 && b[i + 1].is_ascii_digit() && b[i + 2].is_ascii_digit() && b[i + 3].is_ascii_digit() {
            let v = (b[i + 1] - b'0') as u32 * 100 + (b[i + 2] - b'0') as u32 * 10 + (b[i + 3] - b'0') as u32;
            out.push(v.min(255) as u8);
            i += 4;
        } else if b[i] == b'\\' && i + 1 < b.len() {
            out.push(b[i + 1]);
            i += 2;
        } else {
            out.push(b[i]);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub fn xml_unescape(s: &str) -> String {
    s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&#39;", "'")
}
