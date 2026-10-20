#!/usr/bin/env node
/**
 * VPN £10/Day + Revenue Reinvestment Compounding Simulator
 * Models traffic, conversions, upfront cash flow (Anchor Pricing), organic SEO compounding,
 * affiliate/referral loops, and reinvested marketing spend across 6 months (180 days).
 *
 * Usage:
 *   node .agents/skills/vpn-growth-and-cro/scripts/reinvestment_simulator.mjs --base-daily 10 --reinvest-rate 0.65 --months 6
 */

const args = process.argv.slice(2);
const getNum = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? parseFloat(args[i + 1]) : def;
};

const baseDailyGbp = getNum('--base-daily', 10);
const reinvestRate = getNum('--reinvest-rate', 0.65); // 65% of net margin reinvested into next month's ad budget
const months = getNum('--months', 6);

// Pricing & Unit Economics Assumptions (GBP)
// Plan mix: 20% Monthly (£9.99), 30% 6-Monthly (£38.99 upfront), 50% Yearly (£59.99 upfront)
const blendedUpfrontAov = (0.20 * 9.99) + (0.30 * 38.99) + (0.50 * 59.99); // £43.69 upfront cash per new customer
const netMarginAfterCosts = 0.75; // After 5% payment fees, 7% refund reserve, 13% server/infra reserve

const stages = [
  { month: 1, stage: 'Stage 1: Foundation & Diagnostic Validation', cpc: 0.48, paidCvr: 0.024, organicVisits: 650, organicCvr: 0.030, referralMultiplier: 1.08 },
  { month: 2, stage: 'Stage 2: Micro-Niche Paid & Tool Lead-Magnets', cpc: 0.45, paidCvr: 0.031, organicVisits: 1850, organicCvr: 0.035, referralMultiplier: 1.15 },
  { month: 3, stage: 'Stage 3: Reinvestment Flywheel & Affiliate Ignition', cpc: 0.50, paidCvr: 0.036, organicVisits: 4200, organicCvr: 0.038, referralMultiplier: 1.22 },
  { month: 4, stage: 'Stage 4: Multi-Channel Scaling & Retargeting', cpc: 0.54, paidCvr: 0.039, organicVisits: 8500, organicCvr: 0.040, referralMultiplier: 1.28 },
  { month: 5, stage: 'Stage 4+: Programmatic SEO & Creator Scale', cpc: 0.58, paidCvr: 0.040, organicVisits: 14500, organicCvr: 0.042, referralMultiplier: 1.32 },
  { month: 6, stage: 'Stage 4+: Compounding Paid + Organic Dominance', cpc: 0.62, paidCvr: 0.041, organicVisits: 22000, organicCvr: 0.043, referralMultiplier: 1.35 }
];

let reinvestedPoolGbp = 0;
let cumulativeCustomers = 0;
let cumulativeGrossRevenue = 0;
let cumulativeAdSpend = 0;
let cumulativeNetProfitRetained = 0;

const summaryRows = [];

for (let m = 0; m < Math.min(months, stages.length); m++) {
  const s = stages[m];
  const baseMonthlySpend = baseDailyGbp * 30;
  const totalAdSpend = baseMonthlySpend + reinvestedPoolGbp;
  const effectiveDailyBudget = totalAdSpend / 30;

  const paidClicks = Math.round(totalAdSpend / s.cpc);
  const paidSales = Math.round(paidClicks * s.paidCvr);
  const organicSales = Math.round(s.organicVisits * s.organicCvr);
  const totalBaseSales = paidSales + organicSales;
  const totalSalesWithReferrals = Math.round(totalBaseSales * s.referralMultiplier);

  // Upfront cash collected from new sales + recurring monthly renewals from the 25% monthly cohort
  const monthlyRecurringFromPrior = Math.round(cumulativeCustomers * 0.22 * 0.85) * 9.99;
  const grossCashCollected = (totalSalesWithReferrals * blendedUpfrontAov) + monthlyRecurringFromPrior;

  const netContributionBeforeReinvest = (grossCashCollected * netMarginAfterCosts) - totalAdSpend;
  const PositiveContributon = Math.max(0, netContributionBeforeReinvest);

  // Reinvest X% of net contribution into next month's marketing budget (capped at sensible scaling multiplier 2.5x/mo to prevent CPC shock)
  const rawReinvestment = PositiveContributon * reinvestRate;
  const maxSafeReinvest = totalAdSpend * 1.8;
  reinvestedPoolGbp = Math.min(rawReinvestment, maxSafeReinvest);
  const retainedCash = netContributionBeforeReinvest - reinvestedPoolGbp;

  cumulativeCustomers += totalSalesWithReferrals;
  cumulativeGrossRevenue += grossCashCollected;
  cumulativeAdSpend += totalAdSpend;
  cumulativeNetProfitRetained += retainedCash;

  const blendedCac = totalAdSpend / totalSalesWithReferrals;
  const paidOnlyCac = paidSales > 0 ? totalAdSpend / paidSales : 0;
  const day1Roas = grossCashCollected / totalAdSpend;

  summaryRows.push({
    Month: `M${s.month}`,
    'Daily Budget (£)': `£${effectiveDailyBudget.toFixed(2)}`,
    'Total Spend (£)': `£${totalAdSpend.toFixed(0)}`,
    'Paid Clicks': paidClicks,
    'Organic Visits': s.organicVisits,
    'Paid Sales': paidSales,
    'Org+Ref Sales': totalSalesWithReferrals - paidSales,
    'Total New Subs': totalSalesWithReferrals,
    'Paid CAC (£)': `£${paidOnlyCac.toFixed(2)}`,
    'Blended CAC (£)': `£${blendedCac.toFixed(2)}`,
    'Gross Cash (£)': `£${grossCashCollected.toFixed(0)}`,
    'Day-1 ROAS': `${day1Roas.toFixed(2)}x`,
    'Next Mo Reinvest (£)': `£${reinvestedPoolGbp.toFixed(0)}`,
    'Retained Profit (£)': `£${retainedCash.toFixed(0)}`
  });
}

console.log(`=== VPN Growth & Reinvestment Simulation (Base: £${baseDailyGbp}/day | Blended Upfront AOV: £${blendedUpfrontAov.toFixed(2)} | Reinvest Rate: ${(reinvestRate * 100).toFixed(0)}%) ===\n`);
console.table(summaryRows);
console.log(`\n6-Month Cumulative Summary:`);
console.log(`- Total Active / Acquired Customers: ${cumulativeCustomers.toLocaleString()}`);
console.log(`- Cumulative Ad Spend (Base £1,800 + Reinvested Revenue): £${cumulativeAdSpend.toFixed(2)}`);
console.log(`- Cumulative Gross Cash Collected: £${cumulativeGrossRevenue.toFixed(2)}`);
console.log(`- Cumulative Retained Profit (After All Costs & Reinvestment): £${cumulativeNetProfitRetained.toFixed(2)}`);
