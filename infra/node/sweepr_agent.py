#!/usr/bin/env python3
"""SWEEPR VPN node agent.

Runs on every WireGuard server. The only thing it does is add or remove device
public keys on the WireGuard interface when sweeprvpn.com asks it to.

Privacy: it keeps NO browsing or connection logs. The only stored data is
(public key, private tunnel address, hashed licence id, added-at date) so a
licence can be limited to 10 devices. Request logging is disabled.

Security: every request must carry an HMAC-SHA256 signature made with the
shared AGENT_SECRET plus a timestamp (60-second window) and a one-time nonce.
"""
import hashlib, hmac, ipaddress, json, os, re, subprocess, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CONF_DIR = "/etc/sweepr"
STATE = os.path.join(CONF_DIR, "peers.json")
SECRET = open(os.path.join(CONF_DIR, "agent.secret")).read().strip().encode()
IFACE = "wg0"
NET = ipaddress.ip_network("10.64.0.0/16")
SERVER_ADDR = ipaddress.ip_address("10.64.0.1")
MAX_DEVICES = int(os.environ.get("SWEEPR_MAX_DEVICES", "10"))
PEER_TTL_SECONDS = int(os.environ.get("SWEEPR_PEER_TTL_SECONDS", str(72 * 3600)))
PORT = int(os.environ.get("SWEEPR_AGENT_PORT", "8787"))
KEY_RE = re.compile(r"^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw480]=$")

lock = threading.Lock()
nonces = {}
CACHED_PUBLIC_KEY = ""
CACHED_DEVICE_COUNT = 0


def load():
    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return {"peers": {}}


def save(state):
    global CACHED_DEVICE_COUNT
    tmp = STATE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f)
    os.chmod(tmp, 0o600)
    os.replace(tmp, STATE)
    CACHED_DEVICE_COUNT = len(state.get("peers", {}))


def wg(*args):
    subprocess.run(["wg", *args], check=True, capture_output=True)


def server_public_key():
    global CACHED_PUBLIC_KEY
    if CACHED_PUBLIC_KEY:
        return CACHED_PUBLIC_KEY
    CACHED_PUBLIC_KEY = subprocess.run(["wg", "show", IFACE, "public-key"], check=True, capture_output=True, text=True).stdout.strip()
    return CACHED_PUBLIC_KEY


def apply_all(state):
    """Re-adds every stored peer (used at start-up)."""
    for pub, p in state["peers"].items():
        try:
            wg("set", IFACE, "peer", pub, "allowed-ips", p["address"] + "/32")
        except Exception:
            pass


def next_address(state):
    used = {p["address"] for p in state["peers"].values()}
    for host in NET.hosts():
        if host == SERVER_ADDR or host.packed[-1] in (0, 255):
            continue
        s = str(host)
        if s not in used:
            return s
    raise RuntimeError("node full")


def prune_expired_peers_unlocked(state):
    """Evicts peers whose registration lease (default 72h) has expired without re-authentication."""
    if PEER_TTL_SECONDS <= 0:
        return False
    now = int(time.time())
    peers = state.get("peers", {})
    expired = [pub for pub, p in peers.items() if now - int(p.get("added", 0)) > PEER_TTL_SECONDS]
    if not expired:
        return False
    for pub in expired:
        try:
            wg("set", IFACE, "peer", pub, "remove")
        except Exception:
            pass
        peers.pop(pub, None)
    return True


def add_peer(licence, pub):
    with lock:
        state = load()
        prune_expired_peers_unlocked(state)
        peers = state["peers"]
        now = int(time.time())
        if pub in peers:
            peers[pub]["licence"] = licence
            peers[pub]["added"] = now
            save(state)
            return peers[pub]["address"]
        # Enforce the per-licence device limit by retiring the oldest device.
        mine = sorted([(p["added"], k) for k, p in peers.items() if p["licence"] == licence])
        while len(mine) >= MAX_DEVICES:
            _, old = mine.pop(0)
            try:
                wg("set", IFACE, "peer", old, "remove")
            except Exception:
                pass
            peers.pop(old, None)
        addr = next_address(state)
        wg("set", IFACE, "peer", pub, "allowed-ips", addr + "/32")
        peers[pub] = {"address": addr, "licence": licence, "added": now}
        save(state)
        return addr


def remove_peer(pub):
    with lock:
        state = load()
        if state["peers"].pop(pub, None) is not None:
            try:
                wg("set", IFACE, "peer", pub, "remove")
            except Exception:
                pass
            save(state)


def revoke_licence(licence):
    with lock:
        state = load()
        for pub in [k for k, p in state["peers"].items() if p["licence"] == licence]:
            try:
                wg("set", IFACE, "peer", pub, "remove")
            except Exception:
                pass
            state["peers"].pop(pub, None)
        save(state)


class Handler(BaseHTTPRequestHandler):
    server_version = "sweepr-agent"
    timeout = 5

    def log_message(self, *args):  # no request logs, by design
        pass

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authed_body(self):
        length = min(int(self.headers.get("Content-Length", "0") or 0), 4096)
        body = self.rfile.read(length) if length else b""
        ts = self.headers.get("X-Sweepr-Timestamp", "")
        nonce = self.headers.get("X-Sweepr-Nonce", "")
        sig = self.headers.get("X-Sweepr-Signature", "")
        try:
            if abs(time.time() - int(ts)) > 60 or not (8 <= len(nonce) <= 64):
                return None
        except ValueError:
            return None
        msg = "\n".join([self.command, self.path, ts, nonce]).encode() + b"\n" + body
        expected = hmac.new(SECRET, msg, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, sig):
            return None
        now = time.time()
        with lock:
            if len(nonces) >= 10000:
                for k in [k for k, t in list(nonces.items()) if now - t > 120]:
                    nonces.pop(k, None)
                if len(nonces) >= 10000:
                    nonces.pop(next(iter(nonces)), None)
            elif len(nonces) > 256:
                for k in [k for k, t in list(nonces.items()) if now - t > 120]:
                    nonces.pop(k, None)
            if nonce in nonces and now - nonces[nonce] <= 120:
                return None
            nonces[nonce] = now
        try:
            return json.loads(body or b"{}")
        except Exception:
            return None

    def do_GET(self):
        if self.path == "/health":
            # Public: lets the website show which servers are online and how busy they are (zero disk/subprocess I/O).
            return self.reply(200, {"ok": True, "public_key": server_public_key(), "devices": CACHED_DEVICE_COUNT})
        self.reply(404, {"ok": False})

    def do_POST(self):
        data = self.authed_body()
        if data is None:
            return self.reply(401, {"ok": False, "error": "unauthorised"})
        try:
            if self.path == "/peers":
                pub = str(data.get("public_key", ""))
                licence = str(data.get("licence", ""))
                if not KEY_RE.match(pub) or not re.match(r"^[a-f0-9]{16,64}$", licence):
                    return self.reply(400, {"ok": False, "error": "bad_request"})
                addr = add_peer(licence, pub)
                return self.reply(200, {"ok": True, "address": addr + "/32", "dns": str(SERVER_ADDR), "public_key": server_public_key()})
            if self.path == "/peers/remove":
                remove_peer(str(data.get("public_key", "")))
                return self.reply(200, {"ok": True})
            if self.path == "/licences/revoke":
                revoke_licence(str(data.get("licence", "")))
                return self.reply(200, {"ok": True})
        except Exception as e:
            return self.reply(500, {"ok": False, "error": type(e).__name__})
        self.reply(404, {"ok": False})


def peer_reaper_loop():
    while True:
        time.sleep(900)
        try:
            with lock:
                state = load()
                if prune_expired_peers_unlocked(state):
                    save(state)
        except Exception:
            pass


class BoundedHTTPServer(ThreadingHTTPServer):
    request_queue_size = 64
    allow_reuse_address = True
    _sem = threading.BoundedSemaphore(32)

    def process_request(self, request, client_address):
        if not self._sem.acquire(blocking=False):
            self.close_request(request)
            return
        super().process_request(request, client_address)

    def process_request_thread(self, request, client_address):
        try:
            super().process_request_thread(request, client_address)
        finally:
            self._sem.release()


if __name__ == "__main__":
    with lock:
        st = load()
        if prune_expired_peers_unlocked(st):
            save(st)
        else:
            CACHED_DEVICE_COUNT = len(st.get("peers", {}))
        apply_all(st)
        try:
            server_public_key()
        except Exception:
            pass
    threading.Thread(target=peer_reaper_loop, daemon=True).start()
    srv = BoundedHTTPServer(("0.0.0.0", PORT), Handler)
    cert_path = os.environ.get("SWEEPR_TLS_CERT", "")
    key_path = os.environ.get("SWEEPR_TLS_KEY", "")
    if cert_path and key_path and os.path.exists(cert_path) and os.path.exists(key_path):
        import ssl
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.minimum_version = ssl.TLSVersion.TLSv1_3
        ctx.load_cert_chain(certfile=cert_path, keyfile=key_path)
        srv.socket = ctx.wrap_socket(srv.socket, server_side=True)
    srv.serve_forever()
