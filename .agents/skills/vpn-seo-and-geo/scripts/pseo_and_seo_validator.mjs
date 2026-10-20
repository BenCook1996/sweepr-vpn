#!/usr/bin/env node
/**
 * VPN Programmatic SEO Matrix Generator & On-Page SEO/GEO Validator
 * Usage:
 *   node .agents/skills/vpn-seo-and-geo/scripts/pseo_and_seo_validator.mjs --action matrix
 *   node .agents/skills/vpn-seo-and-geo/scripts/pseo_and_seo_validator.mjs --action schema --brand "ApexShield VPN"
 */

const args = process.argv.slice(2);
const actionIdx = args.indexOf('--action');
const action = actionIdx !== -1 ? args[actionIdx + 1] : 'matrix';
const brandIdx = args.indexOf('--brand');
const brandName = brandIdx !== -1 ? args[brandIdx + 1] : 'StealthGuard VPN';

const isps = [
  { name: 'Virgin Media', slug: 'virgin-media', asn: 'AS5089', pop: 'London Docklands (LON-1)' },
  { name: 'BT Broadband', slug: 'bt-broadband', asn: 'AS2856', pop: 'London Slough (LON-2)' },
  { name: 'Sky Broadband', slug: 'sky-broadband', asn: 'AS5607', pop: 'Manchester (MAN-1)' },
  { name: 'TalkTalk', slug: 'talktalk', asn: 'AS13285', pop: 'London Docklands (LON-1)' },
  { name: 'Vodafone UK', slug: 'vodafone-uk', asn: 'AS5378', pop: 'London Slough (LON-2)' },
  { name: 'Eduroam Campus Wi-Fi', slug: 'eduroam-campus-wifi', asn: 'AS786 (Jisc)', pop: 'London / Manchester Multi-Hop' }
];

const useCases = [
  { name: 'Low-Latency Gaming & Packet Loss', slug: 'gaming-packet-loss', ports: 'UDP 3074, 27015-27050' },
  { name: 'Remote SSH, Git & Docker Workflows', slug: 'remote-dev-ssh', ports: 'TCP 22, 443, 2376' },
  { name: '4K Live Sports & High-Bitrate Streaming', slug: 'uhd-streaming-buffering', ports: 'TCP/UDP 443 (QUIC)' },
  { name: 'P2P File Sharing & Port Forwarding', slug: 'p2p-port-forwarding', ports: 'Dynamic Ephemeral TCP/UDP' }
];

const devices = [
  { name: 'GL.iNet Beryl AX / Slate AX Travel Router', slug: 'gl-inet-travel-router' },
  { name: 'Linux CLI (Ubuntu / Debian / Arch)', slug: 'linux-cli-wireguard' },
  { name: 'pfSense & OPNsense Home Firewall', slug: 'pfsense-opnsense-router' },
  { name: 'Steam Deck & Handheld Gaming OS', slug: 'steam-deck-vpn' }
];

if (action === 'matrix') {
  const urls = [];
  for (const isp of isps) {
    for (const uc of useCases) {
      urls.push({
        url: `/solutions/${isp.slug}-${uc.slug}`,
        title: `Fix ${isp.name} Throttling for ${uc.name} (${isp.asn} Routing Guide)`,
        targetKeyword: `${isp.name.toLowerCase()} ${uc.slug.replace(/-/g, ' ')} vpn fix`,
        recommendedPop: isp.pop,
        ports: uc.ports
      });
    }
  }
  for (const dev of devices) {
    urls.push({
      url: `/setup/${dev.slug}`,
      title: `Native WireGuard VPN Setup for ${dev.name} (With Port Forwarding)`,
      targetKeyword: `best wireguard vpn for ${dev.name.toLowerCase()}`,
      recommendedPop: 'All Global RAM-Only Endpoints',
      ports: 'Full WireGuard UDP'
    });
  }

  console.log(`=== Generated ${urls.length} High-Intent Programmatic SEO Landing Page Specs ===`);
  console.table(urls.slice(0, 12));
  console.log(`Total pSEO Cluster Pages Ready: ${urls.length}`);
} else if (action === 'schema') {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: brandName,
    applicationCategory: 'SecurityApplication',
    operatingSystem: 'Windows, macOS, Linux, iOS, Android, OpenWrt, pfSense',
    offers: [
      {
        '@type': 'Offer',
        name: '2-Year Privacy Plan (Best Value)',
        price: '47.76',
        priceCurrency: 'GBP',
        description: '£1.99/month billed every 24 months. Includes 30-day money-back guarantee.'
      },
      {
        '@type': 'Offer',
        name: '1-Year Pro Plan',
        price: '35.88',
        priceCurrency: 'GBP',
        description: '£2.99/month billed annually. Includes 30-day money-back guarantee.'
      }
    ]
  };
  console.log(JSON.stringify(schema, null, 2));
}
