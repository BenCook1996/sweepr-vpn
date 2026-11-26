#!/usr/bin/env node
/**
 * SWEEPR VPN — Central E2E Test Suite Runner
 * Pure Node.js ESM (>=24.0.0) with zero external npm dependencies.
 *
 * Usage:
 *   node tests/e2e/runner.mjs [options]
 *
 * Options:
 *   --tier=<1,2,3,4>     Filter tests by tier (comma-separated, e.g. --tier=1,3)
 *   --feature=<F1..F28>  Filter tests by feature (comma-separated, e.g. --feature=F1,F4)
 *   --verbose            Print detailed test execution details and stack traces
 *   --summary            Print tabular execution summary breakdown
 *   --self-test          Validate test registry, syntax, and harness without starting server
 *   --baseUrl=<url>      Target an already-running server instead of spawning a local child
 *   --help               Display this help text
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as helpers from './helpers.mjs';
import { tier1Tests } from './tier1-features.mjs';
import { tier2Tests } from './tier2-boundaries.mjs';
import { tier3Tests } from './tier3-cross-feature.mjs';
import { tier4Scenarios } from './tier4-scenarios.mjs';

// ANSI Colors
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  gray: '\x1b[90m'
};

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(args) {
  const flags = {
    tiers: null,
    features: null,
    verbose: false,
    summary: false,
    selfTest: false,
    baseUrl: null,
    help: false
  };

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--verbose' || arg === '-v') {
      flags.verbose = true;
    } else if (arg === '--summary') {
      flags.summary = true;
    } else if (arg === '--self-test') {
      flags.selfTest = true;
    } else if (arg.startsWith('--tier=')) {
      flags.tiers = arg.slice(7).split(',').map((s) => Number(s.trim())).filter((n) => !Number.isNaN(n));
    } else if (arg.startsWith('--feature=')) {
      flags.features = arg.slice(10).split(',').map((s) => s.trim().toUpperCase());
    } else if (arg.startsWith('--baseUrl=')) {
      flags.baseUrl = arg.slice(10).trim().replace(/\/+$/, '');
    }
  }

  return flags;
}

function printHelp() {
  console.log(`
${C.bold}${C.cyan}SWEEPR VPN — E2E Test Suite Runner${C.reset}

${C.bold}USAGE:${C.reset}
  node tests/e2e/runner.mjs [options]

${C.bold}OPTIONS:${C.reset}
  ${C.green}--tier=1,2,3,4${C.reset}     Filter tests by tier (comma-separated)
  ${C.green}--feature=F1..F28${C.reset}  Filter tests by feature (comma-separated)
  ${C.green}--verbose${C.reset}          Print verbose assertion and failure output
  ${C.green}--summary${C.reset}          Print execution summary breakdown table
  ${C.green}--self-test${C.reset}        Validate test definitions, registry, and helpers (no server needed)
  ${C.green}--baseUrl=<url>${C.reset}    Target external server (e.g. http://127.0.0.1:8080)
  ${C.green}--help${C.reset}             Display this help message

${C.bold}EXAMPLES:${C.reset}
  node tests/e2e/runner.mjs --self-test
  node tests/e2e/runner.mjs --tier=1 --summary
  node tests/e2e/runner.mjs --feature=F1,F2,F3 --verbose
  node tests/e2e/runner.mjs --summary
`);
}

// ---------------------------------------------------------------------------
// Self-Test Mode
// ---------------------------------------------------------------------------

async function runSelfTest() {
  console.log(`\n${C.bold}${C.cyan}=== SWEEPR VPN E2E Runner: Self-Test Mode ===${C.reset}\n`);
  let selfTestFailures = 0;

  function check(desc, fn) {
    try {
      fn();
      console.log(`  ${C.green}✓${C.reset} ${desc}`);
    } catch (err) {
      selfTestFailures++;
      console.log(`  ${C.red}✗${C.reset} ${desc}: ${err.message}`);
    }
  }

  async function checkAsync(desc, fn) {
    try {
      await fn();
      console.log(`  ${C.green}✓${C.reset} ${desc}`);
    } catch (err) {
      selfTestFailures++;
      console.log(`  ${C.red}✗${C.reset} ${desc}: ${err.message}`);
    }
  }

  // 1. Check Registry Counts
  console.log(`${C.bold}1. Test Registry Inventory Checks:${C.reset}`);
  check(`Tier 1 has >= 140 tests (actual: ${tier1Tests.length})`, () => {
    helpers.assertGreaterThanOrEqual(tier1Tests.length, 140);
  });
  check(`Tier 2 has >= 140 tests (actual: ${tier2Tests.length})`, () => {
    helpers.assertGreaterThanOrEqual(tier2Tests.length, 140);
  });
  check(`Tier 3 has >= 28 tests (actual: ${tier3Tests.length})`, () => {
    helpers.assertGreaterThanOrEqual(tier3Tests.length, 28);
  });
  check(`Tier 4 has >= 14 scenarios (actual: ${tier4Scenarios.length})`, () => {
    helpers.assertGreaterThanOrEqual(tier4Scenarios.length, 14);
  });

  const totalRegistry = tier1Tests.length + tier2Tests.length + tier3Tests.length + tier4Scenarios.length;
  check(`Total registered tests >= 322 (actual: ${totalRegistry})`, () => {
    helpers.assertGreaterThanOrEqual(totalRegistry, 322);
  });

  // 2. Feature Coverage Verification
  console.log(`\n${C.bold}2. Feature Inventory Mapping (F1 to F28):${C.reset}`);
  for (let f = 1; f <= 28; f++) {
    const featureKey = `F${f}`;
    const t1Matches = tier1Tests.filter((t) => t.feature === featureKey || t.id.startsWith(`F${String(f).padStart(2, '0')}`));
    const t2Matches = tier2Tests.filter((t) => t.feature === featureKey || t.id.startsWith(`F${String(f).padStart(2, '0')}`));

    check(`${featureKey} has >= 5 Tier 1 tests (actual: ${t1Matches.length}) and >= 5 Tier 2 tests (actual: ${t2Matches.length})`, () => {
      helpers.assertGreaterThanOrEqual(t1Matches.length, 5, `${featureKey} Tier 1`);
      helpers.assertGreaterThanOrEqual(t2Matches.length, 5, `${featureKey} Tier 2`);
    });
  }

  // 3. Test Structure & Function Validity
  console.log(`\n${C.bold}3. Test Structure Integrity:${C.reset}`);
  const allTests = [...tier1Tests, ...tier2Tests, ...tier3Tests, ...tier4Scenarios];
  check('All test objects have valid id, name, tier, and callable fn', () => {
    const seenIds = new Set();
    for (const t of allTests) {
      helpers.assertTrue(typeof t.id === 'string' && t.id.length > 0, `Test missing id: ${JSON.stringify(t)}`);
      helpers.assertFalse(seenIds.has(t.id), `Duplicate test id: ${t.id}`);
      seenIds.add(t.id);
      helpers.assertTrue(typeof t.name === 'string' && t.name.length > 0, `Test ${t.id} missing name`);
      helpers.assertTrue(typeof t.tier === 'number' && t.tier >= 1 && t.tier <= 4, `Test ${t.id} invalid tier: ${t.tier}`);
      helpers.assertTrue(typeof t.fn === 'function', `Test ${t.id} fn is not a function`);
    }
  });

  // 4. Helper Function Unit Checks
  console.log(`\n${C.bold}4. Helper Utilities Unit Checks:${C.reset}`);
  await checkAsync('getFreePort() allocates a non-privileged ephemeral port > 1024', async () => {
    const port = await helpers.getFreePort();
    helpers.assertGreaterThan(port, 1024);
  });

  check('calculate5GramOverlap() handles identity, disjoint, and empty strings', () => {
    const docA = '<p>The quick brown fox jumps over the lazy dog</p>';
    const docB = '<p>The quick brown fox jumps over the lazy dog</p>';
    const docC = '<p>Completely different text without any common words</p>';
    helpers.assertEqual(helpers.calculate5GramOverlap(docA, docB), 100.0);
    helpers.assertEqual(helpers.calculate5GramOverlap(docA, docC), 0.0);
    helpers.assertEqual(helpers.calculate5GramOverlap('', ''), 0.0);
  });

  check('extractSemanticText() removes tags, scripts, header, and footer', () => {
    const raw = '<header>Header</header><main><p>Hello &amp; World</p></main><footer>Footer</footer>';
    const text = helpers.extractSemanticText(raw);
    helpers.assertFalse(text.includes('Header'));
    helpers.assertFalse(text.includes('Footer'));
    helpers.assertTrue(text.includes('Hello & World'));
  });

  check('validateSitemapXml() parses loc and lastmod correctly', () => {
    const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://sweeprvpn.com/</loc><lastmod>2026-11-13</lastmod></url>
  <url><loc>https://sweeprvpn.com/pricing</loc><lastmod>2026-11-13</lastmod></url>
</urlset>`;
    const res = helpers.validateSitemapXml(sampleXml);
    helpers.assertTrue(res.isValidXml);
    helpers.assertEqual(res.totalUrls, 2);
    helpers.assertEqual(res.lastmods['https://sweeprvpn.com/'], '2026-11-13');
  });

  check('getAuthoritativePillars() lists 62 canonicals without deleted hyperoptic/talktalk-p2p', () => {
    const pillars = helpers.getAuthoritativePillars();
    helpers.assertEqual(pillars.length, 62);
    helpers.assertTrue(pillars.includes('solutions/talktalk-fibre-wireguard-cgnat.html'));
    helpers.assertTrue(pillars.includes('vs/totalvpn.html'));
    helpers.assertFalse(pillars.includes('solutions/hyperoptic-broadband-isp-throttling.html'));
    helpers.assertFalse(pillars.includes('solutions/talktalk-p2p-port-forwarding.html'));
    helpers.assertEqual(typeof helpers.fetchBinary, 'function');
    helpers.assertEqual(typeof helpers.getServerStateDir, 'function');
  });

  // Self-Test Summary
  console.log(`\n${C.bold}Self-Test Summary:${C.reset}`);
  if (selfTestFailures === 0) {
    console.log(`  ${C.green}${C.bold}ALL SELF-TEST CHECKS PASSED (0 failures)${C.reset}\n`);
    return 0;
  } else {
    console.log(`  ${C.red}${C.bold}SELF-TEST FAILED with ${selfTestFailures} failures${C.reset}\n`);
    return 1;
  }
}

// ---------------------------------------------------------------------------
// Normal Execution Mode
// ---------------------------------------------------------------------------

async function runExecution(flags) {
  console.log(`\n${C.bold}${C.cyan}=== SWEEPR VPN E2E Test Suite ===${C.reset}`);
  const startTime = Date.now();

  // Aggregate all tests
  const allTests = [
    ...tier1Tests,
    ...tier2Tests,
    ...tier3Tests,
    ...tier4Scenarios
  ];

  // Filter tests
  const selectedTests = allTests.filter((t) => {
    if (flags.tiers && !flags.tiers.includes(t.tier)) return false;
    if (flags.features) {
      const matchFeature = flags.features.some((f) => {
        if (t.feature) {
          const parts = t.feature.toUpperCase().split('X');
          if (parts.includes(f)) return true;
        }
        const fNum = f.replace(/^F0?/, '');
        const padded = `F${fNum.padStart(2, '0')}`;
        if (t.id && (t.id.startsWith(`${padded}-`) || t.id.startsWith(`${f}-`))) return true;
        return false;
      });
      if (!matchFeature) return false;
    }
    return true;
  });

  if (selectedTests.length === 0) {
    console.log(`${C.yellow}No tests matched the specified criteria.${C.reset}\n`);
    return 0;
  }

  console.log(`Selected ${C.bold}${selectedTests.length}${C.reset} of ${allTests.length} tests across Tiers [${[...new Set(selectedTests.map((t) => t.tier))].sort().join(', ')}]\n`);

  // Check if any selected tests need baseUrl
  const needsServer = selectedTests.some((t) => t.fn.toString().includes('baseUrl'));

  let serverInstance = null;
  let baseUrl = flags.baseUrl;

  if (needsServer && !baseUrl) {
    const freePort = await helpers.getFreePort();
    console.log(`${C.gray}Starting child server on dynamic ephemeral port ${freePort}...${C.reset}`);
    try {
      serverInstance = await helpers.startServer(freePort, { verbose: flags.verbose });
      baseUrl = serverInstance.baseUrl;
      console.log(`${C.green}✓ Server ready at ${baseUrl}${C.reset}\n`);
    } catch (err) {
      console.error(`${C.red}Failed to start local test server: ${err.message}${C.reset}`);
      return 1;
    }

    // Register cleanup hooks
    const cleanup = () => {
      if (serverInstance) {
        helpers.stopServer(serverInstance);
        serverInstance = null;
      }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(1); });
    process.on('SIGTERM', () => { cleanup(); process.exit(1); });
  } else if (baseUrl) {
    console.log(`${C.gray}Targeting specified external server at ${baseUrl}${C.reset}\n`);
  }

  // Execution tracking
  const stateDir = serverInstance?.stateDir || process.env.SWEEPR_STATE_DIR || null;
  const testEnv = stateDir ? { ...process.env, SWEEPR_STATE_DIR: stateDir } : { ...process.env };
  const results = [];
  let passedCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < selectedTests.length; i++) {
    const test = selectedTests[i];
    const testNum = `[${i + 1}/${selectedTests.length}]`;
    const t0 = Date.now();
    let status = 'PASS';
    let error = null;

    try {
      await test.fn({ baseUrl, helpers, stateDir, env: testEnv });
      passedCount++;
    } catch (err) {
      status = 'FAIL';
      error = err;
      failedCount++;
    }
    const durationMs = Date.now() - t0;

    results.push({
      id: test.id,
      name: test.name,
      tier: test.tier,
      feature: test.feature || 'SCENARIO',
      status,
      durationMs,
      error
    });

    if (flags.verbose || status === 'FAIL') {
      const icon = status === 'PASS' ? `${C.green}✓ PASS${C.reset}` : `${C.red}✗ FAIL${C.reset}`;
      console.log(`${C.gray}${testNum}${C.reset} ${icon} ${C.bold}${test.id}${C.reset}: ${test.name} ${C.dim}(${durationMs}ms)${C.reset}`);
      if (error) {
        console.log(`       ${C.red}Error: ${error.message}${C.reset}`);
        if (flags.verbose && error.stack) {
          console.log(`       ${C.gray}${error.stack.split('\n').slice(1, 4).join('\n       ')}${C.reset}`);
        }
      }
    } else {
      process.stdout.write(status === 'PASS' ? `${C.green}.${C.reset}` : `${C.red}F${C.reset}`);
      if ((i + 1) % 50 === 0 || i === selectedTests.length - 1) {
        process.stdout.write(` ${testNum}\n`);
      }
    }
  }

  // Teardown server if spawned
  if (serverInstance) {
    console.log(`\n${C.gray}Tearing down test server on port ${serverInstance.port}...${C.reset}`);
    helpers.stopServer(serverInstance);
    serverInstance = null;
  }

  const totalDurationMs = Date.now() - startTime;

  // Print Summary Table
  console.log(`\n${C.bold}=== Execution Summary ===${C.reset}`);
  console.log(`--------------------------------------------------------------------------------`);
  console.log(`Tier   Feature   Total   Pass   Fail   Duration`);
  console.log(`--------------------------------------------------------------------------------`);

  const tierMap = new Map();
  for (const r of results) {
    const key = `Tier ${r.tier}`;
    if (!tierMap.has(key)) {
      tierMap.set(key, { total: 0, pass: 0, fail: 0, duration: 0 });
    }
    const stats = tierMap.get(key);
    stats.total++;
    if (r.status === 'PASS') stats.pass++;
    if (r.status === 'FAIL') stats.fail++;
    stats.duration += r.durationMs;
  }

  for (const [tier, s] of tierMap.entries()) {
    const statusColor = s.fail === 0 ? C.green : C.red;
    console.log(
      `${tier.padEnd(6)} ` +
      `ALL       ` +
      `${String(s.total).padEnd(7)} ` +
      `${C.green}${String(s.pass).padEnd(6)}${C.reset} ` +
      `${statusColor}${String(s.fail).padEnd(6)}${C.reset} ` +
      `${(s.duration / 1000).toFixed(2)}s`
    );
  }

  console.log(`--------------------------------------------------------------------------------`);
  console.log(
    `Total: ${selectedTests.length} tests | ` +
    `${C.green}${passedCount} Passed${C.reset} | ` +
    `${failedCount > 0 ? C.red : C.green}${failedCount} Failed${C.reset} | ` +
    `Duration: ${(totalDurationMs / 1000).toFixed(2)}s\n`
  );

  if (failedCount > 0) {
    console.log(`${C.red}${C.bold}Failed Tests Details:${C.reset}`);
    for (const r of results.filter((x) => x.status === 'FAIL')) {
      console.log(`  ${C.red}✗ ${r.id}${C.reset}: ${r.name}`);
      console.log(`    ${C.dim}${r.error ? r.error.message : 'Unknown error'}${C.reset}`);
    }
    console.log('');
  }

  return failedCount === 0 ? 0 : 1;
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  if (flags.help) {
    printHelp();
    process.exit(0);
  }

  if (flags.selfTest) {
    const code = await runSelfTest();
    process.exit(code);
  }

  const exitCode = await runExecution(flags);
  process.exit(exitCode);
}

// Only execute when run directly from CLI
const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  main().catch((err) => {
    console.error(`${C.red}Unhandled Fatal Error in runner: ${err.message}${C.reset}`);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  });
}
