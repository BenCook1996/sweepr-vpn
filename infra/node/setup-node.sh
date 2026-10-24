#!/bin/bash
# SWEEPR VPN node setup (Ubuntu 24.04). Run once as root on a fresh server.
# Used as Hetzner/Vultr/UpCloud cloud-init "user data"; __AGENT_SECRET__ is filled in by the provisioning script.
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive

AGENT_SECRET="__AGENT_SECRET__"
WG_PORT=51820
AGENT_PORT=8787

# Disable Vultr's default UFW firewall so our nftables ruleset controls traffic cleanly
ufw disable || true
systemctl stop ufw || true

apt-get -o DPkg::Lock::Timeout=180 update -y
apt-get -o DPkg::Lock::Timeout=180 install -y --no-install-recommends wireguard-tools nftables unbound python3 ca-certificates systemd-timesyncd
timedatectl set-ntp true || systemctl enable --now systemd-timesyncd || true

# ---------------------------------------------------------------- WireGuard
install -d -m 700 /etc/wireguard /etc/sweepr
if [ ! -f /etc/wireguard/server.key ]; then
  umask 077
  wg genkey > /etc/wireguard/server.key
fi
cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = 10.64.0.1/16
ListenPort = ${WG_PORT}
PrivateKey = $(cat /etc/wireguard/server.key)
SaveConfig = false
EOF
chmod 600 /etc/wireguard/wg0.conf
printf '%s' "$AGENT_SECRET" > /etc/sweepr/agent.secret
chmod 600 /etc/sweepr/agent.secret

cat > /etc/sysctl.d/90-sweepr.conf <<EOF
net.ipv4.ip_forward = 1
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr
net.core.rmem_max = 67108864
net.core.wmem_max = 67108864
EOF
sysctl --system >/dev/null || true

# ---------------------------------------------------------------- Firewall + NAT
WAN=$(ip -4 route show default | awk '{print $5; exit}')
CONTROL_PLANE_CIDR="${SWEEPR_CONTROL_PLANE_CIDR:-0.0.0.0/0}"
cat > /etc/nftables.conf <<EOF
#!/usr/sbin/nft -f
flush ruleset
table inet sweepr {
  chain input {
    type filter hook input priority 0; policy drop;
    iif lo accept
    ct state established,related accept
    ip protocol icmp accept
    tcp dport 22 accept
    udp dport ${WG_PORT} accept
    ip saddr ${CONTROL_PLANE_CIDR} tcp dport ${AGENT_PORT} accept
    iifname "wg0" udp dport 53 accept
    iifname "wg0" tcp dport 53 accept
  }
  chain forward {
    type filter hook forward priority 0; policy drop;
    ct state established,related accept
    iifname "wg0" oifname "${WAN}" accept
  }
  chain output { type filter hook output priority 0; policy accept; }
}
table ip sweepr_nat {
  chain postrouting {
    type nat hook postrouting priority 100;
    ip saddr 10.64.0.0/16 oifname "${WAN}" masquerade
  }
}
EOF
systemctl enable --now nftables || true
nft -f /etc/nftables.conf || true

# ---------------------------------------------------------------- Agent + WireGuard
install -m 755 /dev/stdin /usr/local/bin/sweepr_agent.py <<'PYEOF'
__AGENT_PY__
PYEOF
sed -i 's/\r$//' /usr/local/bin/sweepr_agent.py

cat > /etc/systemd/system/sweepr-agent.service <<EOF
[Unit]
Description=SWEEPR VPN node agent
After=wg-quick@wg0.service
Requires=wg-quick@wg0.service

[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/sweepr_agent.py
Environment=SWEEPR_AGENT_PORT=${AGENT_PORT}
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now wg-quick@wg0
systemctl enable --now sweepr-agent

# ---------------------------------------------------------------- Private DNS (no logs) + Smart-TV tracker blocklist
mkdir -p /etc/unbound/unbound.conf.d
cat > /etc/unbound/sweepr-blocklist.conf <<'EOF'
local-zone: "samsungacr.com." always_nxdomain
local-zone: "samsungads.com." always_nxdomain
local-zone: "samsungcloudsolution.net." always_nxdomain
local-zone: "gpm.samsungqbe.com." always_nxdomain
local-zone: "lgtvcommon.com." always_nxdomain
local-zone: "ibs.lgappstv.com." always_nxdomain
local-zone: "ad.lgappstv.com." always_nxdomain
local-zone: "yumenetworks.com." always_nxdomain
local-zone: "scribe.logs.roku.com." always_nxdomain
local-zone: "cooper.logs.roku.com." always_nxdomain
local-zone: "ads.roku.com." always_nxdomain
local-zone: "tvinteractive.tv." always_nxdomain
local-zone: "inscape.tv." always_nxdomain
local-zone: "cognitivetv.com." always_nxdomain
local-zone: "flingo.tv." always_nxdomain
local-zone: "device-metrics-us.amazon.com." always_nxdomain
EOF

cat > /etc/unbound/unbound.conf.d/sweepr.conf <<'EOF'
server:
  interface: 10.64.0.1
  ip-freebind: yes
  access-control: 0.0.0.0/0 refuse
  access-control: 10.64.0.0/16 allow
  verbosity: 0
  log-queries: no
  log-replies: no
  log-servfail: no
  use-syslog: no
  logfile: ""
  hide-identity: yes
  hide-version: yes
  qname-minimisation: yes
  aggressive-nsec: yes
  harden-dnssec-stripped: yes
  prefetch: yes
  include: "/etc/unbound/sweepr-blocklist.conf"
EOF

systemctl restart unbound || true

mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nStorage=volatile\nRuntimeMaxUse=16M\n' > /etc/systemd/journald.conf.d/sweepr.conf
systemctl restart systemd-journald || true

echo "SWEEPR node ready"
