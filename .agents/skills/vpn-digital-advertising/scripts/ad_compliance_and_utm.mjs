#!/usr/bin/env node
/**
 * VPN Ad Policy Compliance Checker & UTM Link Builder
 * Usage:
 *   node .agents/skills/vpn-digital-advertising/scripts/ad_compliance_and_utm.mjs --check "Your ad copy here" --source reddit --medium cpc --campaign launch_uk
 */

const BANNED_PATTERNS = [
  { regex: /\b(unblock|bypass)\s+(netflix|bbc|iplayer|hulu|disney|geoblock|geo-block|firewall|censorship)/i, reason: 'Triggers "Circumventing Systems" / Copyright policy suspension.' },
  { regex: /\b(torrent|pirate|piracy|kodi|stremio|popcorntime|rarbg)\b/i, reason: 'Triggers DMCA / Copyright facilitation disapproval.' },
  { regex: /\b(100%\s+untraceable|invisible\s+to\s+police|fbi|anonymous\s+hacking)\b/i, reason: 'Triggers "Dishonest Behavior" / Unverifiable security claim.' },
  { regex: /\b(hack|cracked|bypass\s+admin|bypass\s+school)\b/i, reason: 'Triggers "Unauthorized Access" policy ban.' }
];

const args = process.argv.slice(2);
const getArg = (flag, fallback = '') => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const copyText = getArg('--check', 'Stop ISP peak-hour throttling with zero-logs WireGuard routing. Try 30 days risk-free.');
const baseUrl = getArg('--url', 'https://yourvpn.com/offer');
const source = getArg('--source', 'reddit');
const medium = getArg('--medium', 'cpc');
const campaign = getArg('--campaign', 'stage1_microbudget_uk');
const content = getArg('--content', 'founder_text_ad_v1');

console.log('=== 1. VPN Ad Policy Compliance Scan ===');
console.log(`Input Copy (${copyText.length} chars): "${copyText}"`);

const violations = [];
for (const rule of BANNED_PATTERNS) {
  if (rule.regex.test(copyText)) {
    violations.push(rule.reason);
  }
}

if (violations.length === 0) {
  console.log('STATUS: [PASS] Zero policy-violating trigger phrases detected.');
} else {
  console.log('STATUS: [FAIL] Policy risk detected:');
  violations.forEach((v, i) => console.log(`  ${i + 1}. ${v}`));
}

console.log('\n=== 2. Platform Character Limit Checks ===');
console.log(`- Google Ads Headline (Max 30):  ${copyText.length <= 30 ? 'FITS' : `TOO LONG (${copyText.length}/30)`}`);
console.log(`- Google Ads Desc (Max 90):      ${copyText.length <= 90 ? 'FITS' : `TOO LONG (${copyText.length}/90)`}`);
console.log(`- Reddit Ad Title (Max 300):     ${copyText.length <= 300 ? 'FITS' : `TOO LONG (${copyText.length}/300)`}`);

const urlObj = new URL(baseUrl);
urlObj.searchParams.set('utm_source', source.toLowerCase());
urlObj.searchParams.set('utm_medium', medium.toLowerCase());
urlObj.searchParams.set('utm_campaign', campaign.toLowerCase());
urlObj.searchParams.set('utm_content', content.toLowerCase());

console.log('\n=== 3. Standardized Campaign Tracking URL ===');
console.log(urlObj.toString());
