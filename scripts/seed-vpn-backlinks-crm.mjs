/**
 * SWEEPR VPN — Curated Directory, Citation & Backlink CRM Seeder (`project_id = 'vpn'`)
 *
 * Seeds 45+ legitimate software directories, privacy/cybersecurity registries,
 * comparison platforms, launch directories, and GitHub awesome-lists directly into
 * the SWEEPR CRM SQLite database (`outreach_logs`, `seo_backlinks`, and `seo_keywords`).
 *
 * Strictly zero emails are sent. All entries are recorded as Web Portal / Self-Service
 * submissions with pre-written copy in `notes`.
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';

const crmDbPath = 'C:\\Users\\Benjamin\\Downloads\\sweepr_crm\\data\\sweepr-crm.db';
if (!fs.existsSync(crmDbPath)) {
  console.error('SWEEPR CRM database not found at:', crmDbPath);
  process.exit(1);
}

const db = new DatabaseSync(crmDbPath);
const now = Math.floor(Date.now() / 1000);

const VPN_DIRECTORY_TARGETS = [
  // Tier 1: Major Software Comparison & Review Platforms (DR 80–93)
  {
    who: 'AlternativeTo Product Directory',
    website: 'alternativeto.net',
    url: 'https://alternativeto.net/software/total-vpn/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 86 · Software Alternatives Directory (Tag: Total VPN, NordVPN, ExpressVPN, Mullvad)',
    status: 'pending',
    notes: 'Submit at https://alternativeto.net/manage/new-item/ — Name: SWEEPR VPN | URL: https://sweeprvpn.com | License: Commercial with Free Wi-Fi Scanner | Platforms: Windows, Mac, Linux, iOS, Android | Tags: VPN, Wi-Fi Analyzer, Privacy, No-Logs.'
  },
  {
    who: 'G2 Crowd VPN Software Category',
    website: 'g2.com',
    url: 'https://www.g2.com/categories/vpn',
    how: 'Web Portal Vendor Claim (Free)',
    category: 'DR 92 · B2B & Consumer Software Directory (Dofollow Profile)',
    status: 'pending',
    notes: 'Submit new product at https://www.g2.com/products/new — Category: Virtual Private Network (VPN) & Wi-Fi Security | Target URL: https://sweeprvpn.com'
  },
  {
    who: 'Capterra / Gartner Digital Markets',
    website: 'capterra.com',
    url: 'https://www.capterra.com/vpn-software/',
    how: 'Web Portal Vendor Claim (Free)',
    category: 'DR 91 · Gartner Software Directory (VPN & Network Security)',
    status: 'pending',
    notes: 'Vendor signup at https://www.capterra.com/vendors/sign-up — Lists across Capterra, GetApp, and Software Advice simultaneously.'
  },
  {
    who: 'SourceForge Software Directory',
    website: 'sourceforge.net',
    url: 'https://sourceforge.net/software/vpn/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 92 · Software & Cybersecurity Directory',
    status: 'pending',
    notes: 'Add product listing at https://sourceforge.net/software/vendors/new — Highlight ~14MB lightweight installer, 1-click privacy, and free Home Wi-Fi Scanner.'
  },
  {
    who: 'Trustpilot Business Profile (UK & Global)',
    website: 'trustpilot.com',
    url: 'https://uk.trustpilot.com/review/sweeprvpn.com',
    how: 'Web Portal Domain Claim (Free)',
    category: 'DR 93 · Consumer Trust & AI Search Citation Signal',
    status: 'pending',
    notes: 'Claim domain sweeprvpn.com at https://business.trustpilot.com/signup — High-weight entity signal for ChatGPT, Perplexity, and Google AI Overviews.'
  },
  {
    who: 'Slashdot Software Directory',
    website: 'slashdot.org',
    url: 'https://slashdot.org/software/vpn/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 90 · Tech & Cybersecurity Software Index',
    status: 'pending',
    notes: 'Submit vendor listing at https://slashdot.org/software/vendors/new — Target URL: https://sweeprvpn.com'
  },
  {
    who: 'SaaSHub Software Alternatives',
    website: 'saashub.com',
    url: 'https://www.saashub.com/best-vpn-software-alternatives',
    how: 'Web Portal Submission (Free)',
    category: 'DR 77 · SaaS & Privacy Tool Comparison Hub',
    status: 'pending',
    notes: 'Submit product at https://www.saashub.com/submit — Map as alternative to Total VPN, NordVPN, Surfshark, CyberGhost.'
  },
  {
    who: 'Slant Community Recommendations',
    website: 'slant.co',
    url: 'https://www.slant.co/topics/1989/~best-vpn-services',
    how: 'Web Portal Contribution (Free)',
    category: 'DR 78 · Structured Pros/Cons Comparison Engine (Cited by LLMs)',
    status: 'pending',
    notes: 'Add SWEEPR VPN option with pros: ~14MB lightweight app, honest price-lock renewals (£74.99/yr Save 50%), built-in 30s Wi-Fi device scanner, Smart-TV spy blocker.'
  },

  // Tier 2: Product Launch & Indie Tech Directories (DR 70–91)
  {
    who: 'Product Hunt Launch Listing',
    website: 'producthunt.com',
    url: 'https://www.producthunt.com/topics/privacy',
    how: 'Web Portal Launch (Free)',
    category: 'DR 91 · Tech Product Launch & Dofollow Launch Page',
    status: 'pending',
    notes: 'Submit at https://www.producthunt.com/posts/new — Tagline: "Secure your Wi-Fi in seconds. 1-click VPN + Home Wi-Fi scanner." Link both https://sweeprvpn.com and https://sweeprvpn.com/tools/leak-test.'
  },
  {
    who: 'Hacker News (Show HN — Free Leak & Throttling Tools)',
    website: 'news.ycombinator.com',
    url: 'https://news.ycombinator.com/show',
    how: 'Web Portal Post (Free)',
    category: 'DR 90 · Developer & Privacy Community Launch',
    status: 'pending',
    notes: 'Submit Show HN pointing to the zero-signup engineering tools: https://sweeprvpn.com/tools/leak-test or https://sweeprvpn.com/tools/isp-throttling-test'
  },
  {
    who: 'BetaList Startup Directory',
    website: 'betalist.com',
    url: 'https://betalist.com/topics/security',
    how: 'Web Portal Submission (Free Queue)',
    category: 'DR 78 · Early-Adopter & Security Startup Directory',
    status: 'pending',
    notes: 'Submit at https://betalist.com/submit — Focus on lightweight 1-click VPN + Smart-TV spy blocker.'
  },
  {
    who: 'DevHunt Developer & Privacy Tools',
    website: 'devhunt.org',
    url: 'https://devhunt.org/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 71 · Developer & Network Utility Launchpad',
    status: 'pending',
    notes: 'Submit SWEEPR VPN & Free IP/WebRTC Leak Test (https://sweeprvpn.com/tools/leak-test).'
  },
  {
    who: 'Indie Hackers Product Directory',
    website: 'indiehackers.com',
    url: 'https://www.indiehackers.com/products',
    how: 'Web Portal Product Page (Free)',
    category: 'DR 80 · Bootstrapped SaaS & Security Product Directory',
    status: 'pending',
    notes: 'Create product profile at https://www.indiehackers.com/products/new linking to https://sweeprvpn.com.'
  },
  {
    who: 'Uneed Best Tech & Privacy Tools',
    website: 'uneed.best',
    url: 'https://www.uneed.best/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 68 · Curated Tech & Security Tool Directory',
    status: 'pending',
    notes: 'Submit at https://www.uneed.best/submit — Category: Security & Privacy.'
  },
  {
    who: 'Launching Next Startup Directory',
    website: 'launchingnext.com',
    url: 'https://www.launchingnext.com/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 67 · Startup Discovery Directory',
    status: 'pending',
    notes: 'Submit startup at https://www.launchingnext.com/submit/ linking to https://sweeprvpn.com.'
  },
  {
    who: 'BetaPage Startup Directory',
    website: 'betapage.co',
    url: 'https://betapage.co/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 66 · Tech & Privacy Product Directory',
    status: 'pending',
    notes: 'Submit product at https://betapage.co/startup/submit — Target URL: https://sweeprvpn.com.'
  },
  {
    who: 'SideProjectors Directory',
    website: 'sideprojectors.com',
    url: 'https://www.sideprojectors.com/',
    how: 'Web Portal Showcase (Free)',
    category: 'DR 65 · Software Showcase Directory',
    status: 'pending',
    notes: 'Submit showcase project linking to https://sweeprvpn.com and https://sweeprvpn.com/tools/leak-test.'
  },
  {
    who: 'MicroLaunch Tech Directory',
    website: 'microlaunch.net',
    url: 'https://microlaunch.net/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 62 · SaaS & Utility Launch Platform (Dofollow Badge/Link)',
    status: 'pending',
    notes: 'Submit SWEEPR VPN at https://microlaunch.net/ — Category: Privacy & Security.'
  },
  {
    who: 'TinyLaunch Directory',
    website: 'tinylaunch.com',
    url: 'https://www.tinylaunch.com/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 58 · Indie Software Launch Directory',
    status: 'pending',
    notes: 'Submit SWEEPR VPN listing linking to https://sweeprvpn.com.'
  },
  {
    who: 'Fazier Product Launch Directory',
    website: 'fazier.com',
    url: 'https://fazier.com/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 60 · Product Launch & SaaS Directory',
    status: 'pending',
    notes: 'Submit at https://fazier.com/ — Target URL: https://sweeprvpn.com.'
  },

  // Tier 3: Windows, Mac & Cross-Platform Software Download Portals (DR 75–92)
  {
    who: 'Softpedia Windows Security Downloads',
    website: 'softpedia.com',
    url: 'https://www.softpedia.com/get/Security/',
    how: 'Web Portal Developer Submission (Free)',
    category: 'DR 89 · Authoritative Desktop Software Download Index',
    status: 'pending',
    notes: 'Submit software at https://www.softpedia.com/user/submit.shtml — Provide https://sweeprvpn.com/download?platform=win (SWEEPRVPN.exe).'
  },
  {
    who: 'MajorGeeks Security & Privacy Tools',
    website: 'majorgeeks.com',
    url: 'https://www.majorgeeks.com/mg/sortname/security.html',
    how: 'Web Portal Submission (Free)',
    category: 'DR 80 · Trusted Windows Utility & Security Download Portal',
    status: 'pending',
    notes: 'Submit SWEEPR VPN & Free 30-Second Home Wi-Fi Scanner (~14MB zero-bloatware Windows 10/11 utility).'
  },
  {
    who: 'SnapFiles Freeware & Shareware Directory',
    website: 'snapfiles.com',
    url: 'https://www.snapfiles.com/Chaos/security-privacy.html',
    how: 'Web Portal Developer Submission (Free)',
    category: 'DR 76 · Curated Windows Software Directory',
    status: 'pending',
    notes: 'Developer submission at https://www.snapfiles.com/submit/ — Highlight free Home Wi-Fi & Speed Scanner.'
  },
  {
    who: 'FileCluster Windows Software Directory',
    website: 'filecluster.com',
    url: 'https://www.filecluster.com/Network-Tools/',
    how: 'Web Portal Developer Submission (Free)',
    category: 'DR 70 · Network & Security Software Directory',
    status: 'pending',
    notes: 'Submit SWEEPR VPN desktop installer and homepage https://sweeprvpn.com.'
  },
  {
    who: 'DownloadCrew Software Portal',
    website: 'downloadcrew.com',
    url: 'https://www.downloadcrew.com/category/security_and_privacy',
    how: 'Web Portal Submission (Free)',
    category: 'DR 74 · UK & Global Software Download Directory',
    status: 'pending',
    notes: 'Submit SWEEPR VPN (UK-priced £74.99/yr Save 50% or £1.99 1st-month intro).'
  },
  {
    who: 'LO4D Windows Security & VPN Directory',
    website: 'lo4d.com',
    url: 'https://www.lo4d.com/en/windows/vpn',
    how: 'Web Portal Developer Submission (Free)',
    category: 'DR 73 · Independently Tested Windows VPN Directory',
    status: 'pending',
    notes: 'Submit at https://www.lo4d.com/en/contact — Link https://sweeprvpn.com and https://sweeprvpn.com/download.'
  },

  // Tier 4: GitHub Awesome Lists & Open-Source Privacy Indices (DR 96 — High AI/LLM Citation Weight)
  {
    who: 'GitHub awesome-privacy (Lissy93)',
    website: 'github.com/Lissy93/awesome-privacy',
    url: 'https://github.com/Lissy93/awesome-privacy',
    how: 'GitHub Pull Request / Discussion (Free)',
    category: 'DR 96 · Top Privacy Resource Index (Heavily Cited by ChatGPT & Perplexity)',
    status: 'pending',
    notes: 'Submit PR/Discussion referencing SWEEPR Free IP, DNS & WebRTC Leak Test (https://sweeprvpn.com/tools/leak-test) and zero-logs WireGuard VPN.'
  },
  {
    who: 'GitHub awesome-security (sbilly)',
    website: 'github.com/sbilly/awesome-security',
    url: 'https://github.com/sbilly/awesome-security',
    how: 'GitHub Pull Request (Free)',
    category: 'DR 96 · Network & Endpoint Security Resource List',
    status: 'pending',
    notes: 'Submit PR under Network Diagnostic / Privacy Tools for https://sweeprvpn.com/tools/leak-test and https://sweeprvpn.com/tools/isp-throttling-test.'
  },
  {
    who: 'GitHub free-for-dev (ripienaar)',
    website: 'github.com/ripienaar/free-for-dev',
    url: 'https://github.com/ripienaar/free-for-dev',
    how: 'GitHub Pull Request (Free)',
    category: 'DR 96 · Free Diagnostic & Security Tools for Developers',
    status: 'pending',
    notes: 'Submit PR adding the zero-signup browser diagnostic tools: https://sweeprvpn.com/tools/leak-test and https://sweeprvpn.com/tools/isp-throttling-test.'
  },
  {
    who: 'PrivacyTools Community Forum & Directory',
    website: 'privacytools.io',
    url: 'https://www.privacytools.io/',
    how: 'Web Forum / Directory Suggestion (Free)',
    category: 'DR 81 · Privacy Enthusiast Directory & Community',
    status: 'pending',
    notes: 'Share SWEEPR VPN zero-logs policy (https://sweeprvpn.com/privacy) and free leak test tool (https://sweeprvpn.com/tools/leak-test).'
  },

  // Tier 5: B2B, Startup & SaaS Directories (DR 65–88)
  {
    who: 'Crunchbase Company Profile',
    website: 'crunchbase.com',
    url: 'https://www.crunchbase.com/',
    how: 'Web Portal Company Creation (Free)',
    category: 'DR 91 · Authoritative Company Knowledge Graph Signal',
    status: 'pending',
    notes: 'Create SWEEPR VPN Inc. profile linking to https://sweeprvpn.com — Strengthens Google Knowledge Graph & LLM entity recognition.'
  },
  {
    who: 'F6S Startup & SaaS Directory',
    website: 'f6s.com',
    url: 'https://www.f6s.com/companies/cyber-security/uk/co',
    how: 'Web Portal Company Profile (Free)',
    category: 'DR 82 · UK & Global Cybersecurity Startup Directory',
    status: 'pending',
    notes: 'Create company profile at https://www.f6s.com/ — Link https://sweeprvpn.com.'
  },
  {
    who: 'Wellfound (AngelList Talent) Company Profile',
    website: 'wellfound.com',
    url: 'https://wellfound.com/',
    how: 'Web Portal Company Profile (Free)',
    category: 'DR 88 · Tech Company Directory',
    status: 'pending',
    notes: 'Create SWEEPR VPN company profile linking to https://sweeprvpn.com.'
  },
  {
    who: 'Crozdesk Software Finder',
    website: 'crozdesk.com',
    url: 'https://crozdesk.com/software/it-security',
    how: 'Web Portal Vendor Signup (Free)',
    category: 'DR 75 · UK & Global Software Comparison Directory',
    status: 'pending',
    notes: 'Register vendor account at https://vendor.crozdesk.com/ — Category: IT Security & VPN.'
  },
  {
    who: 'GoodFirms VPN Software Directory',
    website: 'goodfirms.co',
    url: 'https://www.goodfirms.co/vpn-software/',
    how: 'Web Portal Vendor Listing (Free)',
    category: 'DR 83 · Software Review & Comparison Directory',
    status: 'pending',
    notes: 'Add product at https://www.goodfirms.co/get-listed — Target URL: https://sweeprvpn.com.'
  },
  {
    who: 'SoftwareSuggest VPN Directory',
    website: 'softwaresuggest.com',
    url: 'https://www.softwaresuggest.com/vpn-software',
    how: 'Web Portal Vendor Listing (Free)',
    category: 'DR 77 · Software Discovery & Comparison Platform',
    status: 'pending',
    notes: 'Submit free vendor listing at https://www.softwaresuggest.com/vendors — Target URL: https://sweeprvpn.com.'
  },
  {
    who: 'TechImply Software Directory',
    website: 'techimply.com',
    url: 'https://www.techimply.com/software/vpn-software',
    how: 'Web Portal Vendor Listing (Free)',
    category: 'DR 69 · IT & Security Software Directory',
    status: 'pending',
    notes: 'Submit product listing at https://www.techimply.com/add-product linking to https://sweeprvpn.com.'
  },
  {
    who: 'SaaSWorthy VPN Software Index',
    website: 'saasworthy.com',
    url: 'https://www.saasworthy.com/list/vpn-software',
    how: 'Web Portal Product Submission (Free)',
    category: 'DR 76 · SaaS & Security Software Rating Index',
    status: 'pending',
    notes: 'Submit at https://www.saasworthy.com/offerings — Highlight 50% annual savings (£74.99/yr) and Smart-TV spy blocker.'
  },
  {
    who: 'Serchen Cloud & Security Marketplace',
    website: 'serchen.com',
    url: 'https://www.serchen.com/category/vpn/',
    how: 'Web Portal Vendor Listing (Free)',
    category: 'DR 72 · UK Cloud & Security Software Directory',
    status: 'pending',
    notes: 'Create free vendor profile at https://www.serchen.com/get-listed/ linking to https://sweeprvpn.com.'
  },
  {
    who: 'ITQlick Software Directory',
    website: 'itqlick.com',
    url: 'https://www.itqlick.com/vpn-software',
    how: 'Web Portal Vendor Submission (Free)',
    category: 'DR 71 · Software Comparison & Pricing Directory',
    status: 'pending',
    notes: 'Submit product details and transparent price-lock tiers for https://sweeprvpn.com/pricing.'
  },

  // Tier 6: Free Tool & Web Utility Directories (Linking to /tools/leak-test & /tools/isp-throttling-test)
  {
    who: 'TinyWow / Free Web Tools Directories (ToolPilot)',
    website: 'toolpilot.ai',
    url: 'https://www.toolpilot.ai/',
    how: 'Web Portal Tool Submission (Free)',
    category: 'DR 64 · Online Utility & Diagnostic Tool Directory',
    status: 'pending',
    notes: 'Submit Free IP, DNS & WebRTC Leak Test (https://sweeprvpn.com/tools/leak-test).'
  },
  {
    who: 'Futurepedia Utility & Security Tools',
    website: 'futurepedia.io',
    url: 'https://www.futurepedia.io/',
    how: 'Web Portal Tool Submission (Free)',
    category: 'DR 79 · Software & Smart Utility Directory',
    status: 'pending',
    notes: 'Submit SWEEPR Wi-Fi Radar & Smart-TV Shield + Free ISP Speed Slowdown Checker (https://sweeprvpn.com/tools/isp-throttling-test).'
  },
  {
    who: 'There Is An AI / Tool For That (Web Utilities)',
    website: 'theresanaiforthat.com',
    url: 'https://theresanaiforthat.com/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 82 · High-Traffic Tool Discovery Index',
    status: 'pending',
    notes: 'Submit automated Home Wi-Fi Device Scanner & Smart-TV Spy Blocker (https://sweeprvpn.com).'
  },
  {
    who: 'StartupStash Curated Security Tools',
    website: 'startupstash.com',
    url: 'https://startupstash.com/',
    how: 'Web Portal Submission (Free)',
    category: 'DR 78 · Curated Tools & Resources Directory',
    status: 'pending',
    notes: 'Submit SWEEPR VPN & Free Leak Test at https://startupstash.com/add-listing/.'
  },
  {
    who: 'StackShare Security & Network Tools',
    website: 'stackshare.io',
    url: 'https://stackshare.io/',
    how: 'Web Portal Tool Creation (Free)',
    category: 'DR 84 · Developer & Security Tool Index',
    status: 'pending',
    notes: 'Add SWEEPR VPN under Security / Network Privacy tools linking to https://sweeprvpn.com.'
  }
];

const VPN_SEO_KEYWORDS = [
  // Brand & Core Commercial
  { keyword: 'sweepr vpn', cluster: 'brand', target_path: '/' },
  { keyword: 'sweepr wifi radar', cluster: 'brand', target_path: '/' },
  { keyword: 'sweepr vpn pricing', cluster: 'brand', target_path: '/pricing' },
  // Competitor Comparisons & Switchers (BOFU)
  { keyword: 'total vpn alternative', cluster: 'alternatives', target_path: '/alternatives/totalvpn' },
  { keyword: 'best total vpn alternatives 2026', cluster: 'alternatives', target_path: '/alternatives/totalvpn' },
  { keyword: 'sweepr vpn vs total vpn', cluster: 'comparisons', target_path: '/vs/totalvpn' },
  { keyword: 'totalvpn renewal price hike alternative', cluster: 'alternatives', target_path: '/vs/totalvpn' },
  { keyword: 'vpn with no renewal price increase uk', cluster: 'pricing', target_path: '/pricing' },
  { keyword: 'cheap first month vpn uk', cluster: 'pricing', target_path: '/pricing' },
  // Free Interactive Diagnostic Tools (TOFU Link Magnets)
  { keyword: 'free ip dns webrtc leak test', cluster: 'free-tools', target_path: '/tools/leak-test' },
  { keyword: 'webrtc leak test uk', cluster: 'free-tools', target_path: '/tools/leak-test' },
  { keyword: 'check if my ip address is exposed', cluster: 'free-tools', target_path: '/tools/leak-test' },
  { keyword: 'dns leak checker online free', cluster: 'free-tools', target_path: '/tools/leak-test' },
  { keyword: 'isp throttling test uk', cluster: 'free-tools', target_path: '/tools/isp-throttling-test' },
  { keyword: 'check if virgin media is throttling my internet', cluster: 'free-tools', target_path: '/tools/isp-throttling-test' },
  { keyword: 'stop bt evening streaming buffering vpn', cluster: 'free-tools', target_path: '/tools/isp-throttling-test' },
  { keyword: 'stop sky broadband slowing down streaming', cluster: 'free-tools', target_path: '/tools/isp-throttling-test' },
  { keyword: 'isp speed slowdown checker', cluster: 'free-tools', target_path: '/tools/isp-throttling-test' },
  // Home Wi-Fi Scanner & Smart-TV Privacy (MOFU Problem-Aware)
  { keyword: 'see who is on my home wifi windows 11', cluster: 'wifi-scanner', target_path: '/' },
  { keyword: 'home wifi unknown device scanner free', cluster: 'wifi-scanner', target_path: '/' },
  { keyword: 'block smart tv spying acr tracking', cluster: 'smart-tv', target_path: '/' },
  { keyword: 'stop samsung lg smart tv taking screenshots', cluster: 'smart-tv', target_path: '/' },
  { keyword: 'lightweight vpn for windows 11 no bloatware', cluster: 'core', target_path: '/' },
  { keyword: 'simple 1 click vpn for home wifi', cluster: 'core', target_path: '/' }
];

const upsertOutreachStmt = db.prepare(`
  INSERT INTO outreach_logs (project_id, who, website, url, how, category, status, message_id, notes, reached_out_at, updated_at)
  VALUES ('vpn', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)
  ON CONFLICT(project_id, who, website) DO UPDATE SET
    url = COALESCE(excluded.url, outreach_logs.url),
    how = excluded.how,
    category = COALESCE(excluded.category, outreach_logs.category),
    notes = COALESCE(excluded.notes, outreach_logs.notes),
    updated_at = excluded.updated_at
`);

const selectOutreachStmt = db.prepare(`
  SELECT id, url FROM outreach_logs WHERE project_id = 'vpn' AND who = ? AND website = ?
`);

const insertBacklinkStmt = db.prepare(`
  INSERT OR IGNORE INTO seo_backlinks (project_id, outreach_id, source_url, source_domain, target_domain, status, created_at)
  VALUES ('vpn', ?, ?, ?, 'sweeprvpn.com', 'unverified', ?)
`);

const insertKeywordStmt = db.prepare(`
  INSERT OR IGNORE INTO seo_keywords (project_id, keyword, cluster, target_path, created_at)
  VALUES ('vpn', ?, ?, ?, ?)
`);

let outreachSeeded = 0;
let backlinksSeeded = 0;
let keywordsSeeded = 0;

db.exec('BEGIN');
try {
  for (const item of VPN_DIRECTORY_TARGETS) {
    upsertOutreachStmt.run(
      item.who,
      item.website,
      item.url,
      item.how,
      item.category,
      item.status,
      item.notes,
      now,
      now
    );
    outreachSeeded++;

    const row = selectOutreachStmt.get(item.who, item.website);
    if (row && row.url) {
      const u = new URL(row.url);
      const domain = u.hostname.replace(/^www\./, '').toLowerCase();
      const res = insertBacklinkStmt.run(row.id, u.toString(), domain, now);
      if (res.changes > 0) backlinksSeeded++;
    }
  }

  for (const kw of VPN_SEO_KEYWORDS) {
    const res = insertKeywordStmt.run(kw.keyword, kw.cluster, kw.target_path, now);
    if (res.changes > 0) keywordsSeeded++;
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  throw err;
}

const totalOutreach = db.prepare("SELECT COUNT(*) AS c FROM outreach_logs WHERE project_id = 'vpn'").get();
const totalBacklinks = db.prepare("SELECT COUNT(*) AS c FROM seo_backlinks WHERE project_id = 'vpn'").get();
const totalKeywords = db.prepare("SELECT COUNT(*) AS c FROM seo_keywords WHERE project_id = 'vpn'").get();

console.log(JSON.stringify({
  ok: true,
  project: 'vpn',
  emails_sent: 0,
  outreach_upserted: outreachSeeded,
  total_vpn_outreach_in_crm: totalOutreach.c,
  new_backlinks_added: backlinksSeeded,
  total_vpn_backlinks_in_crm: totalBacklinks.c,
  new_keywords_added: keywordsSeeded,
  total_vpn_keywords_in_crm: totalKeywords.c
}, null, 2));
