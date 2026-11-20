#!/usr/bin/env node
/**
 * SWEEPR VPN — Release Manifest & Checksum Parity Verifier
 *
 * Verifies local parity across:
 *   - website/SWEEPRVPN.exe & website/SWEEPRVPN.dmg (computed actual SHA-256 & byte sizes)
 *   - website/pad.xml (<Program_Version>, <File_Size_Bytes>)
 *   - chocolatey/sweepr-vpn.nuspec, chocolatey/tools/chocolateyInstall.ps1, chocolatey/tools/VERIFICATION.txt
 *   - scripts/cloud-security-audit.mjs & scripts/weekly-ga4-and-gsc-funnel-audit.mjs
 *
 * With `--check-remote`, also fetches live raw manifests from BenCook1996/scoop-sweepr
 * and BenCook1996/homebrew-sweepr and asserts matching version & SHA-256 checksums.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const checkRemote = process.argv.includes('--check-remote');

const failures = [];
const pass = (label, detail) => console.log(`✅ [PASS] ${label}: ${detail}`);
const fail = (label, detail) => {
  failures.push(`${label}: ${detail}`);
  console.error(`❌ [FAIL] ${label}: ${detail}`);
};

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function fileHashAndSize(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) return null;
  const buf = fs.readFileSync(full);
  return {
    size: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex').toUpperCase()
  };
}

async function main() {
  const exe = fileHashAndSize('website/SWEEPRVPN.exe');
  const dmg = fileHashAndSize('website/SWEEPRVPN.dmg');
  if (!exe) return fail('website/SWEEPRVPN.exe', 'Missing Windows installer');
  if (!dmg) return fail('website/SWEEPRVPN.dmg', 'Missing macOS installer');
  pass('Local Binaries', `EXE=${exe.size} B (${exe.sha256.slice(0, 12)}...) | DMG=${dmg.size} B (${dmg.sha256.slice(0, 12)}...)`);

  // 1. pad.xml
  const padXml = read('website/pad.xml');
  const padVer = (padXml.match(/<Program_Version>([^<]+)<\/Program_Version>/) || [])[1]?.trim() || '';
  const padBytes = Number((padXml.match(/<File_Size_Bytes>(\d+)<\/File_Size_Bytes>/) || [])[1] || 0);
  if (!padVer || padBytes !== exe.size) {
    fail('website/pad.xml', `version=${padVer || 'missing'} file_size_bytes=${padBytes} expected_exe_size=${exe.size}`);
  } else {
    pass('website/pad.xml', `v${padVer} matches EXE size ${padBytes} B`);
  }

  // 2. Chocolatey manifests
  const nuspec = read('chocolatey/sweepr-vpn.nuspec');
  const chocoVer = (nuspec.match(/<version>([^<]+)<\/version>/) || [])[1]?.trim() || '';
  const chocoNotesOk = nuspec.includes(`/releases/tag/v${padVer}<`);
  if (chocoVer !== padVer || !chocoNotesOk) {
    fail('chocolatey/sweepr-vpn.nuspec', `version=${chocoVer} expected=${padVer} notesTagMatch=${chocoNotesOk}`);
  } else {
    pass('chocolatey/sweepr-vpn.nuspec', `v${chocoVer} matches pad.xml`);
  }

  const chocoPs1 = read('chocolatey/tools/chocolateyInstall.ps1');
  const chocoSha = (chocoPs1.match(/checksum64\s*=\s*'([0-9A-Fa-f]{64})'/) || [])[1]?.toUpperCase() || '';
  const chocoUrlOk = chocoPs1.includes(`/v${padVer}/SWEEPRVPN.exe`) || chocoPs1.includes('sweeprvpn.com/SWEEPRVPN.exe');
  if (chocoSha !== exe.sha256 || !chocoUrlOk) {
    fail('chocolatey/tools/chocolateyInstall.ps1', `checksum64=${chocoSha} expected=${exe.sha256} urlOk=${chocoUrlOk}`);
  } else {
    pass('chocolatey/tools/chocolateyInstall.ps1', `SHA-256 parity verified (${chocoSha.slice(0, 12)}...)`);
  }

  const verTxt = read('chocolatey/tools/VERIFICATION.txt');
  if (!verTxt.includes(`Version: ${padVer}`) || !verTxt.toUpperCase().includes(exe.sha256)) {
    fail('chocolatey/tools/VERIFICATION.txt', `Must contain Version: ${padVer} and SHA-256 ${exe.sha256}`);
  } else {
    pass('chocolatey/tools/VERIFICATION.txt', `Version ${padVer} & EXE SHA-256 verified`);
  }

  // 3. Audit script constants parity
  for (const auditScript of ['scripts/cloud-security-audit.mjs', 'scripts/weekly-ga4-and-gsc-funnel-audit.mjs']) {
    const src = read(auditScript);
    const sSha = (src.match(/EXPECTED_EXE_SHA256\s*=\s*'([0-9A-Fa-f]{64})'/) || [])[1]?.toUpperCase() || '';
    const sSize = Number((src.match(/EXPECTED_EXE_SIZE\s*=\s*(\d+)/) || [])[1] || 0);
    if (sSha !== exe.sha256 || sSize !== exe.size) {
      fail(auditScript, `EXPECTED_EXE_SHA256=${sSha} (${sSize} B) != actual (${exe.sha256} / ${exe.size} B)`);
    } else {
      pass(auditScript, `EXE hash & size match (${sSize} B)`);
    }
  }

  // 4. Optional remote Scoop & Homebrew raw manifest verification
  if (checkRemote) {
    const scoopRes = await fetch('https://raw.githubusercontent.com/BenCook1996/scoop-sweepr/main/bucket/sweepr-vpn.json', {
      signal: AbortSignal.timeout(12000)
    });
    if (!scoopRes.ok) {
      fail('Remote scoop-sweepr', `HTTP ${scoopRes.status}`);
    } else {
      const scoop = await scoopRes.json();
      const sHash = String(scoop?.architecture?.['64bit']?.hash || '').toUpperCase();
      if (scoop.version !== padVer || sHash !== exe.sha256) {
        fail('Remote scoop-sweepr', `version=${scoop.version} expected=${padVer} | hash=${sHash} expected=${exe.sha256}`);
      } else {
        pass('Remote scoop-sweepr', `v${scoop.version} SHA-256 matches live SWEEPRVPN.exe`);
      }
    }

    const brewRes = await fetch('https://raw.githubusercontent.com/BenCook1996/homebrew-sweepr/main/Casks/sweepr-vpn.rb', {
      signal: AbortSignal.timeout(12000)
    });
    if (!brewRes.ok) {
      fail('Remote homebrew-sweepr', `HTTP ${brewRes.status}`);
    } else {
      const rb = await brewRes.text();
      const bVer = (rb.match(/version\s+"([^"]+)"/) || [])[1] || '';
      const bSha = (rb.match(/sha256\s+"([0-9A-Fa-f]{64})"/) || [])[1]?.toUpperCase() || '';
      if (bVer !== padVer || bSha !== dmg.sha256) {
        fail('Remote homebrew-sweepr', `version=${bVer} expected=${padVer} | sha256=${bSha} expected=${dmg.sha256}`);
      } else {
        pass('Remote homebrew-sweepr', `v${bVer} SHA-256 matches live SWEEPRVPN.dmg`);
      }
    }
  }

  if (failures.length > 0) {
    console.error(`\n❌ Release Manifest Guard FAILED (${failures.length} error(s)).`);
    process.exit(1);
  }
  console.log('\n✅ All release manifest & checksum parity checks PASSED.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
