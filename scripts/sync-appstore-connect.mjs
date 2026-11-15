#!/usr/bin/env node
/**
 * Syncs App Store Connect subscriptions, localizations, and App Review metadata
 * from apps/mobile-ios/SweeprVPN.storekit using the official App Store Connect REST API v1.
 *
 * Usage:
 *   node scripts/sync-appstore-connect.mjs --dry-run
 *   ASC_ISSUER_ID=... ASC_KEY_ID=... ASC_PRIVATE_KEY_PATH=/path/AuthKey.p8 node scripts/sync-appstore-connect.mjs
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const STOREKIT_PATH = path.join(ROOT, 'apps', 'mobile-ios', 'SweeprVPN.storekit');
const ASC_BASE = 'https://api.appstoreconnect.apple.com/v1';
const BUNDLE_ID = 'com.sweepr.vpn';
const SUPPORT_EMAIL = 'support@sweeprvpn.com';
const SUPPORT_URL = 'https://sweeprvpn.com/support.html?app=1';

const PERIOD_MAP = {
  P1W: 'ONE_WEEK',
  P1M: 'ONE_MONTH',
  P2M: 'TWO_MONTHS',
  P3M: 'THREE_MONTHS',
  P6M: 'SIX_MONTHS',
  P1Y: 'ONE_YEAR'
};

function loadStoreKitCatalog() {
  const raw = fs.readFileSync(STOREKIT_PATH, 'utf8');
  const json = JSON.parse(raw);
  const groups = Array.isArray(json.subscriptionGroups) ? json.subscriptionGroups : [];
  assert.ok(groups.length > 0, 'SweeprVPN.storekit must contain at least one subscriptionGroup');

  const mappedGroups = groups.map((group) => ({
    referenceName: String(group.name || 'SWEEPR VPN Pro'),
    subscriptions: (group.subscriptions || []).map((sub) => {
      const subscriptionPeriod = PERIOD_MAP[sub.recurringSubscriptionPeriod];
      assert.ok(
        subscriptionPeriod,
        `Unsupported recurringSubscriptionPeriod "${sub.recurringSubscriptionPeriod}" on ${sub.productID}`
      );
      const localizations = (sub.localizations || []).flatMap((loc) => {
        const normalized = String(loc.locale || 'en_GB').replace('_', '-');
        const entry = {
          locale: normalized,
          name: String(loc.displayName || sub.referenceName),
          description: String(loc.description || sub.referenceName)
        };
        if (normalized === 'en-GB') {
          return [entry, { ...entry, locale: 'en-US' }];
        }
        return [entry];
      });
      return {
        productId: String(sub.productID),
        name: String(sub.referenceName),
        groupLevel: Number(sub.groupNumber) || 1,
        familySharable: Boolean(sub.familyShareable),
        subscriptionPeriod,
        displayPriceGbp: String(sub.displayPrice || ''),
        introductoryOffer: sub.introductoryOffer || null,
        localizations
      };
    })
  }));

  return mappedGroups;
}

function createAppStoreConnectJwt({ issuerId, keyId, privateKeyPem }) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      iss: issuerId,
      iat: now,
      exp: now + 19 * 60,
      aud: 'appstoreconnect-v1'
    })
  ).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const sig = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: privateKeyPem,
    dsaEncoding: 'ieee-p1363'
  });
  return `${signingInput}.${sig.toString('base64url')}`;
}

function buildReviewNotes(demoEmail) {
  return [
    'SWEEPR VPN App Review Guide:',
    `1. Sign in via Account -> Enter License Key using Demo Email "${demoEmail}" and the demo key below (or test via StoreKit Sandbox purchase).`,
    '2. Tap Connect -> review the Pre-Consent VPN Data Disclosure sheet -> allow VPN configuration permission.',
    '3. Toggle Smart-TV & Tracker DNS Shield and inspect the live local network / Bonjour diagnostic screen.',
    '4. Self-service account deletion is available in Account -> Delete Account & Data.'
  ].join('\n');
}

function buildPlannedOperations(catalog, demoEmail, demoPassword) {
  const ops = [
    {
      step: 'Lookup App ID',
      method: 'GET',
      path: `/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`
    }
  ];

  for (const group of catalog) {
    ops.push({
      step: `Ensure Subscription Group "${group.referenceName}"`,
      method: 'POST',
      path: '/subscriptionGroups',
      body: {
        data: {
          type: 'subscriptionGroups',
          attributes: { referenceName: group.referenceName },
          relationships: { app: { data: { type: 'apps', id: '<APP_ID>' } } }
        }
      }
    });

    for (const sub of group.subscriptions) {
      ops.push({
        step: `Ensure Subscription "${sub.productId}"`,
        method: 'POST',
        path: '/subscriptions',
        body: {
          data: {
            type: 'subscriptions',
            attributes: {
              name: sub.name,
              productId: sub.productId,
              familySharable: sub.familySharable,
              subscriptionPeriod: sub.subscriptionPeriod,
              groupLevel: sub.groupLevel,
              reviewNote: `Anchor & Decoy tier synced from SweeprVPN.storekit (GB reference £${sub.displayPriceGbp})`
            },
            relationships: {
              group: { data: { type: 'subscriptionGroups', id: '<SUBSCRIPTION_GROUP_ID>' } }
            }
          }
        }
      });

      for (const loc of sub.localizations) {
        ops.push({
          step: `Ensure Localization ${loc.locale} for "${sub.productId}"`,
          method: 'POST',
          path: '/subscriptionLocalizations',
          body: {
            data: {
              type: 'subscriptionLocalizations',
              attributes: loc,
              relationships: {
                subscription: { data: { type: 'subscriptions', id: '<SUBSCRIPTION_ID>' } }
              }
            }
          }
        });
      }
    }
  }

  ops.push({
    step: 'Update App Store Review Detail',
    method: 'PATCH',
    path: '/appStoreReviewDetails/<REVIEW_DETAIL_ID>',
    body: {
      data: {
        type: 'appStoreReviewDetails',
        id: '<REVIEW_DETAIL_ID>',
        attributes: {
          contactFirstName: 'SWEEPR',
          contactLastName: 'Support',
          contactEmail: SUPPORT_EMAIL,
          demoAccountName: demoEmail,
          demoAccountPassword: demoPassword ? '[SET_FROM_ENV]' : '<PROVIDE_APP_REVIEW_DEMO_KEY>',
          demoAccountRequired: true,
          notes: buildReviewNotes(demoEmail)
        }
      }
    }
  });

  return ops;
}

async function ascFetch(token, relPath, init = {}) {
  const res = await fetch(`${ASC_BASE}${relPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const detail = json?.errors?.map((e) => `${e.status} ${e.title}: ${e.detail}`).join('; ') || text;
    throw new Error(`App Store Connect ${init.method || 'GET'} ${relPath} failed (${res.status}): ${detail}`);
  }
  return json;
}

async function runDryRun(catalog, demoEmail, demoPassword) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const testPem = privateKey.export({ type: 'pkcs8', format: 'pem' });
  const jwt = createAppStoreConnectJwt({
    issuerId: '00000000-0000-0000-0000-000000000000',
    keyId: 'DRYRUNKEY1',
    privateKeyPem: testPem
  });
  const parts = jwt.split('.');
  assert.equal(parts.length, 3, 'JWT must contain 3 segments');
  const verified = crypto.verify(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`, 'utf8'),
    { key: publicKey, dsaEncoding: 'ieee-p1363' },
    Buffer.from(parts[2], 'base64url')
  );
  assert.equal(verified, true, 'Ephemeral ES256 JWT self-verification failed');

  const ops = buildPlannedOperations(catalog, demoEmail, demoPassword);
  console.log('App Store Connect Sync — DRY RUN');
  console.log(`- StoreKit catalog: ${path.relative(ROOT, STOREKIT_PATH)}`);
  console.log(`- Bundle ID: ${BUNDLE_ID}`);
  console.log(`- Support Email / URL: ${SUPPORT_EMAIL} | ${SUPPORT_URL}`);
  console.log(`- ES256 JWT Self-Check: OK (${parts[0].length + parts[1].length + parts[2].length + 2} bytes)`);
  console.log(`- Subscription products validated: ${catalog.flatMap((g) => g.subscriptions).map((s) => s.productId).join(', ')}`);
  console.log(`- Planned API operations (${ops.length}):`);
  for (const op of ops) {
    console.log(`  * [${op.method}] ${op.path} — ${op.step}`);
  }
  console.log('\nReminder: Configure Server Notifications V2 URL manually in App Store Connect -> App Information:');
  console.log('  https://sweeprvpn.com/api/webhooks/apple');
  console.log('Dry-run validation passed.');
}

async function runLiveSync(catalog, demoEmail, demoPassword) {
  const issuerId = String(process.env.ASC_ISSUER_ID || '').trim();
  const keyId = String(process.env.ASC_KEY_ID || '').trim();
  let privateKeyPem = String(process.env.ASC_PRIVATE_KEY_P8 || '').trim();
  if (!privateKeyPem && process.env.ASC_PRIVATE_KEY_PATH) {
    privateKeyPem = fs.readFileSync(path.resolve(process.env.ASC_PRIVATE_KEY_PATH), 'utf8');
  }
  if (!issuerId || !keyId || !privateKeyPem) {
    throw new Error(
      'Missing ASC_ISSUER_ID, ASC_KEY_ID, and ASC_PRIVATE_KEY_PATH (or ASC_PRIVATE_KEY_P8). Re-run with --dry-run to validate payloads offline.'
    );
  }

  const token = createAppStoreConnectJwt({ issuerId, keyId, privateKeyPem });
  const appResp = await ascFetch(token, `/apps?filter[bundleId]=${encodeURIComponent(BUNDLE_ID)}`);
  const app = appResp?.data?.[0];
  if (!app) throw new Error(`App with bundleId=${BUNDLE_ID} not found in App Store Connect`);
  const appId = app.id;
  console.log(`Found App Store Connect app "${app.attributes?.name}" (id=${appId})`);

  const existingGroupsResp = await ascFetch(token, `/apps/${appId}/subscriptionGroups?limit=50`);
  const existingGroups = new Map(
    (existingGroupsResp.data || []).map((g) => [g.attributes?.referenceName, g])
  );

  for (const group of catalog) {
    let groupRecord = existingGroups.get(group.referenceName);
    if (!groupRecord) {
      const created = await ascFetch(token, '/subscriptionGroups', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'subscriptionGroups',
            attributes: { referenceName: group.referenceName },
            relationships: { app: { data: { type: 'apps', id: appId } } }
          }
        })
      });
      groupRecord = created.data;
      console.log(`Created subscription group "${group.referenceName}" (id=${groupRecord.id})`);
    } else {
      console.log(`Subscription group "${group.referenceName}" exists (id=${groupRecord.id})`);
    }

    const existingSubsResp = await ascFetch(
      token,
      `/subscriptionGroups/${groupRecord.id}/subscriptions?limit=100`
    );
    const existingSubs = new Map(
      (existingSubsResp.data || []).map((s) => [s.attributes?.productId, s])
    );

    for (const sub of group.subscriptions) {
      let subRecord = existingSubs.get(sub.productId);
      if (!subRecord) {
        const createdSub = await ascFetch(token, '/subscriptions', {
          method: 'POST',
          body: JSON.stringify({
            data: {
              type: 'subscriptions',
              attributes: {
                name: sub.name,
                productId: sub.productId,
                familySharable: sub.familySharable,
                subscriptionPeriod: sub.subscriptionPeriod,
                groupLevel: sub.groupLevel,
                reviewNote: `Anchor & Decoy tier synced from SweeprVPN.storekit (GB reference £${sub.displayPriceGbp})`
              },
              relationships: {
                group: { data: { type: 'subscriptionGroups', id: groupRecord.id } }
              }
            }
          })
        });
        subRecord = createdSub.data;
        console.log(`  + Created subscription ${sub.productId} (id=${subRecord.id})`);
      } else {
        console.log(`  = Subscription ${sub.productId} exists (id=${subRecord.id})`);
      }

      const locsResp = await ascFetch(
        token,
        `/subscriptions/${subRecord.id}/subscriptionLocalizations?limit=50`
      );
      const existingLocales = new Set((locsResp.data || []).map((l) => l.attributes?.locale));
      for (const loc of sub.localizations) {
        if (!existingLocales.has(loc.locale)) {
          await ascFetch(token, '/subscriptionLocalizations', {
            method: 'POST',
            body: JSON.stringify({
              data: {
                type: 'subscriptionLocalizations',
                attributes: loc,
                relationships: {
                  subscription: { data: { type: 'subscriptions', id: subRecord.id } }
                }
              }
            })
          });
          console.log(`    + Added localization ${loc.locale}`);
        }
      }
    }
  }

  const versionsResp = await ascFetch(
    token,
    `/apps/${appId}/appStoreVersions?filter[appStoreState]=PREPARE_FOR_SUBMISSION,DEVELOPER_REJECTED,REJECTED&limit=10`
  );
  for (const ver of versionsResp.data || []) {
    const detailResp = await ascFetch(token, `/appStoreVersions/${ver.id}/appStoreReviewDetail`).catch(() => null);
    const attrs = {
      contactFirstName: 'SWEEPR',
      contactLastName: 'Support',
      contactEmail: SUPPORT_EMAIL,
      demoAccountName: demoEmail,
      demoAccountRequired: true,
      notes: buildReviewNotes(demoEmail),
      ...(demoPassword ? { demoAccountPassword: demoPassword } : {})
    };
    if (detailResp?.data?.id) {
      await ascFetch(token, `/appStoreReviewDetails/${detailResp.data.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          data: { type: 'appStoreReviewDetails', id: detailResp.data.id, attributes: attrs }
        })
      });
      console.log(`Updated App Review detail on version ${ver.attributes?.versionString} (${ver.attributes?.platform})`);
    } else {
      await ascFetch(token, '/appStoreReviewDetails', {
        method: 'POST',
        body: JSON.stringify({
          data: {
            type: 'appStoreReviewDetails',
            attributes: attrs,
            relationships: {
              appStoreVersion: { data: { type: 'appStoreVersions', id: ver.id } }
            }
          }
        })
      });
      console.log(`Created App Review detail on version ${ver.attributes?.versionString} (${ver.attributes?.platform})`);
    }
  }

  console.log('\nLive sync complete.');
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || process.env.ASC_DRY_RUN === '1';
  const catalog = loadStoreKitCatalog();
  const demoEmail = String(process.env.APP_REVIEW_DEMO_EMAIL || 'appreview@sweeprvpn.com').trim();
  const demoPassword = String(process.env.APP_REVIEW_DEMO_KEY || '').trim();

  if (isDryRun) {
    await runDryRun(catalog, demoEmail, demoPassword);
    return;
  }
  await runLiveSync(catalog, demoEmail, demoPassword);
}

main().catch((err) => {
  console.error('sync-appstore-connect failed:', err.message);
  process.exit(1);
});
