import { readFile, writeFile, mkdir } from 'node:fs/promises';
import type { FirstSetRecord } from './types.js';
import { VALID_SET_TOTALS, LINES } from './types.js';

// ═══════════════════════════════════════════
// MATH HELPERS
// ═══════════════════════════════════════════

function removeVig(overPrice: number, underPrice: number) {
  const rawOver = 1 / overPrice;
  const rawUnder = 1 / underPrice;
  const total = rawOver + rawUnder;
  return {
    fairOver: rawOver / total,
    fairUnder: rawUnder / total,
    vig: total - 1,
  };
}

/** Per-match empirical z-score — correct for heterogeneous implied probabilities */
function zScoreEmpirical(edges: number[]): number {
  const n = edges.length;
  if (n < 2) return 0;
  const mean = edges.reduce((a, b) => a + b, 0) / n;
  const variance = edges.reduce((a, e) => a + (e - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  return se > 0 ? mean / se : 0;
}

/** 95% confidence interval on ROI */
function roiCI(bets: number[]): { roi: number; lo: number; hi: number; se: number } {
  const n = bets.length;
  if (n < 2) return { roi: 0, lo: 0, hi: 0, se: 0 };
  const mean = bets.reduce((a, b) => a + b, 0) / n;
  const variance = bets.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  return { roi: mean, lo: mean - 1.96 * se, hi: mean + 1.96 * se, se };
}

// ═══════════════════════════════════════════
// SEGMENTATION HELPERS
// ═══════════════════════════════════════════

const SCORE_LABELS: Record<number, string> = {
  6: '6-0', 7: '6-1', 8: '6-2', 9: '6-3',
  10: '6-4', 12: '7-5', 13: '7-6(TB)',
};

function classifyTour(league: string): 'ATP' | 'WTA' {
  const l = league.toUpperCase();
  if (l.includes('WTA') || l.includes('WOMEN')) return 'WTA';
  // ITF Women already caught above. Everything else is men's side.
  return 'ATP';
}

function classifyTier(league: string): string {
  const l = league.toUpperCase();
  if (l.includes('ITF')) return 'ITF';
  if (l.includes('CHALLENGER')) return 'Challenger';
  if (l.includes('125K') || l.includes('125')) return '125K';
  if (l.includes('QUALIFIER') || l.includes('QUALIF')) return 'Qualifiers';
  return 'Main';
}

function classifyRound(league: string): string {
  if (/Final/i.test(league)) return 'Final';
  if (/SF|Semi/i.test(league)) return 'SF';
  if (/QF|Quarter/i.test(league)) return 'QF';
  if (/R16/i.test(league)) return 'R16';
  if (/R3/i.test(league)) return 'R3';
  if (/R2/i.test(league)) return 'R2';
  if (/R1/i.test(league)) return 'R1';
  return 'Other';
}

const EARLY_ROUNDS = new Set(['R1', 'R2', 'R3']);

// ═══════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════

const pct = (v: number) => (v * 100).toFixed(1) + '%';
const roiFmt = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
const pad = (s: string, w: number) => s.padStart(w);

// ═══════════════════════════════════════════
// LAYER 1: BASELINE ROI TABLE
// ═══════════════════════════════════════════

interface ROIResult {
  label: string;
  line: number;
  direction: 'Over' | 'Under';
  n: number;
  hits: number;
  hitRate: number;
  roi: number;
  roiLo: number;
  roiHi: number;
  z: number;
  significant: boolean;
}

function computeROI(
  records: FirstSetRecord[],
  line: number,
  direction: 'Over' | 'Under',
  label: string,
  priceField: 'closing' | 'opening' = 'closing',
): ROIResult | null {
  const bets: number[] = [];
  const edges: number[] = [];
  let hits = 0;

  for (const rec of records) {
    const snap = rec.lines.find(l => l.line === line);
    if (!snap) continue;

    const overPrice = priceField === 'closing' ? snap.closing_over : snap.opening_over;
    const underPrice = priceField === 'closing' ? snap.closing_under : snap.opening_under;
    if (!overPrice || !underPrice || overPrice <= 1 || underPrice <= 1) continue;

    const { fairOver, fairUnder } = removeVig(overPrice, underPrice);
    const won = direction === 'Over'
      ? rec.set1_total > line
      : rec.set1_total <= line;
    const price = direction === 'Over' ? overPrice : underPrice;
    const fairProb = direction === 'Over' ? fairOver : fairUnder;

    bets.push(won ? price - 1 : -1);
    edges.push((won ? 1 : 0) - fairProb);
    if (won) hits++;
  }

  if (bets.length < 20) return null;

  const ci = roiCI(bets);
  const z = zScoreEmpirical(edges);

  return {
    label,
    line,
    direction,
    n: bets.length,
    hits,
    hitRate: hits / bets.length,
    roi: ci.roi,
    roiLo: ci.lo,
    roiHi: ci.hi,
    z,
    significant: ci.lo > 0,
  };
}

function formatROITable(title: string, results: ROIResult[]): string {
  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(105));
  out.push(title);
  out.push('═'.repeat(105));
  out.push(
    'Segment'.padEnd(20) + ' | Line  | Dir   |    N | Hit%   |    ROI   | 95% CI               | z     | Sig',
  );
  out.push('─'.repeat(105));

  for (const r of results) {
    const sig = r.significant ? ' YES' : '  no';
    out.push(
      `${r.label.padEnd(20)} | ${pad(String(r.line), 4)}  | ${r.direction.padEnd(5)} | ` +
      `${pad(String(r.n), 4)} | ${pad(pct(r.hitRate), 5)} | ` +
      `${pad(roiFmt(r.roi), 7)} | [${roiFmt(r.roiLo)}, ${roiFmt(r.roiHi)}] | ` +
      `${pad(r.z.toFixed(2), 5)} |${sig}`,
    );
  }
  return out.join('\n');
}

// ═══════════════════════════════════════════
// LAYER 2: DISTRIBUTION
// ═══════════════════════════════════════════

function formatDistribution(records: FirstSetRecord[]): string {
  const dist = new Map<number, number>();
  for (const r of records) dist.set(r.set1_total, (dist.get(r.set1_total) ?? 0) + 1);

  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(62));
  out.push('FIRST-SET TOTAL GAMES DISTRIBUTION');
  out.push('═'.repeat(62));
  out.push('Total | Score    | Count |    %   | Cumul. | Bar');
  out.push('─'.repeat(62));

  let cumulative = 0;
  for (const total of VALID_SET_TOTALS) {
    const count = dist.get(total) ?? 0;
    const p = count / records.length;
    cumulative += p;
    const bar = '█'.repeat(Math.round(p * 40));
    out.push(
      `   ${pad(String(total), 2)} | ${pad(SCORE_LABELS[total] ?? '?', 8)} | ` +
      `${pad(String(count), 5)} | ${pad(pct(p), 5)} | ${pad(pct(cumulative), 5)} | ${bar}`,
    );
  }

  const sum = records.reduce((s, r) => s + r.set1_total, 0);
  out.push(`\nTotal records: ${records.length}`);
  out.push(`Mean total:    ${(sum / records.length).toFixed(2)}`);
  return out.join('\n');
}

// ═══════════════════════════════════════════
// LAYER 3: CROSS-LINE PROBABILITY DECOMP
// ═══════════════════════════════════════════

function formatCrossLine(records: FirstSetRecord[], label = 'ALL'): string {
  // Only use records with both lines present for each pair
  const pairs: Array<{ from: number; to: number; scoreTotal: number; scoreLabel: string }> = [
    { from: 8.5, to: 9.5, scoreTotal: 9, scoreLabel: '6-3' },
    { from: 9.5, to: 10.5, scoreTotal: 10, scoreLabel: '6-4' },
    { from: 10.5, to: 12.5, scoreTotal: 12, scoreLabel: '7-5' },
  ];

  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(80));
  out.push(`CROSS-LINE PROBABILITY DECOMPOSITION — ${label}`);
  out.push('═'.repeat(80));
  out.push('Scoreline | Actual %  | Implied % | Gap       | Interpretation');
  out.push('─'.repeat(80));

  for (const { from, to, scoreTotal, scoreLabel } of pairs) {
    const recs = records.filter(
      r => r.lines.some(l => l.line === from) && r.lines.some(l => l.line === to),
    );
    if (recs.length < 50) continue;

    let actualCount = 0;
    let impliedSum = 0;

    for (const rec of recs) {
      if (rec.set1_total === scoreTotal) actualCount++;
      const snapFrom = rec.lines.find(l => l.line === from)!;
      const snapTo = rec.lines.find(l => l.line === to)!;
      const fairFromOver = removeVig(snapFrom.closing_over, snapFrom.closing_under).fairOver;
      const fairToOver = removeVig(snapTo.closing_over, snapTo.closing_under).fairOver;
      impliedSum += fairFromOver - fairToOver;
    }

    const actual = actualCount / recs.length;
    const implied = impliedSum / recs.length;
    const gap = actual - implied;
    const interp = gap > 0.02 ? 'UNDERESTIMATED by market'
      : gap < -0.02 ? 'OVERESTIMATED by market'
      : 'Fairly priced';

    out.push(
      `${pad(scoreLabel, 9)} | ${pad(pct(actual), 8)} | ${pad(pct(implied), 8)} | ` +
      `${pad(roiFmt(gap), 8)} | ${interp}  (N=${recs.length})`,
    );
  }

  // Tiebreak (over 12.5) — standalone
  const tbRecs = records.filter(r => r.lines.some(l => l.line === 12.5));
  if (tbRecs.length >= 50) {
    let actualTB = 0;
    let impliedTB = 0;
    for (const rec of tbRecs) {
      if (rec.set1_total === 13) actualTB++;
      const snap = rec.lines.find(l => l.line === 12.5)!;
      impliedTB += removeVig(snap.closing_over, snap.closing_under).fairOver;
    }
    const actual = actualTB / tbRecs.length;
    const implied = impliedTB / tbRecs.length;
    const gap = actual - implied;
    out.push(
      `${pad('7-6(TB)', 9)} | ${pad(pct(actual), 8)} | ${pad(pct(implied), 8)} | ` +
      `${pad(roiFmt(gap), 8)} | ${gap > 0.02 ? 'UNDERESTIMATED' : gap < -0.02 ? 'OVERESTIMATED' : 'Fairly priced'}  (N=${tbRecs.length})`,
    );
  }

  return out.join('\n');
}

// ═══════════════════════════════════════════
// LAYER 4: MONTHLY ROI CONSISTENCY
// ═══════════════════════════════════════════

function formatMonthlyROI(
  records: FirstSetRecord[],
  line: number,
  direction: 'Over' | 'Under',
): string {
  const months = new Map<string, FirstSetRecord[]>();
  for (const rec of records) {
    const m = rec.date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(rec);
  }

  const out: string[] = [];
  out.push(`\nMonthly ROI — ${direction} ${line}:`);
  out.push('Month    |    N | Hit%   |    ROI   | Cumulative P/L');
  out.push('─'.repeat(62));

  const sorted = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let posMonths = 0;
  let validMonths = 0;
  let cumPL = 0;

  for (const [month, recs] of sorted) {
    const r = computeROI(recs, line, direction, month);
    if (!r || r.n < 10) {
      out.push(`${month} | ${pad(String(r?.n ?? 0), 4)} |  (skipped — N < 10)`);
      continue;
    }
    validMonths++;
    if (r.roi > 0) posMonths++;
    cumPL += r.roi * r.n;
    out.push(
      `${month} | ${pad(String(r.n), 4)} | ${pad(pct(r.hitRate), 5)} | ` +
      `${pad(roiFmt(r.roi), 7)} | $${cumPL.toFixed(2)}`,
    );
  }

  const needed = Math.ceil(validMonths * 0.6);
  out.push(`\nPositive months: ${posMonths}/${validMonths}  (need >=${needed} for 60% consistency)`);
  return out.join('\n');
}

// ═══════════════════════════════════════════
// LAYER 5: OPENING vs CLOSING COMPARISON
// ═══════════════════════════════════════════

function formatOpeningVsClosing(records: FirstSetRecord[]): string {
  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(80));
  out.push('OPENING vs CLOSING PRICE ROI');
  out.push('(Opening = pre-match entry. Closing = final line before set starts.)');
  out.push('═'.repeat(80));
  out.push(
    'Line  | Dir   | N(open) |  ROI@Open |  ROI@Close | Diff      | Better entry?',
  );
  out.push('─'.repeat(80));

  // Only check lines and directions that showed promise at closing
  const candidates: Array<{ line: number; dir: 'Over' | 'Under' }> = [
    { line: 10.5, dir: 'Under' },
    { line: 12.5, dir: 'Under' },
    { line: 8.5, dir: 'Under' },
    { line: 6.5, dir: 'Over' },
  ];

  for (const { line, dir } of candidates) {
    const openR = computeROI(records, line, dir, 'open', 'opening');
    const closeR = computeROI(records, line, dir, 'close', 'closing');
    if (!openR || !closeR) continue;

    const diff = openR.roi - closeR.roi;
    const better = diff > 0.005 ? 'Opening' : diff < -0.005 ? 'Closing' : 'Similar';

    out.push(
      `${pad(String(line), 4)}  | ${dir.padEnd(5)} | ${pad(String(openR.n), 5)}   | ` +
      `${pad(roiFmt(openR.roi), 8)} | ${pad(roiFmt(closeR.roi), 9)} | ` +
      `${pad(roiFmt(diff), 8)} | ${better}`,
    );
  }

  return out.join('\n');
}

// ═══════════════════════════════════════════
// LAYER 6: GO/NO-GO — ROI-BASED
// ═══════════════════════════════════════════

function formatGoNoGo(allResults: ROIResult[]): string {
  // Rank by significance first, then by ROI
  const profitable = allResults
    .filter(r => r.roi > 0 && r.n >= 30)
    .sort((a, b) => {
      if (a.significant !== b.significant) return a.significant ? -1 : 1;
      return b.roi - a.roi;
    });

  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(90));
  out.push('DECISION TABLE — ACTIONABLE BETTING RULES');
  out.push('═'.repeat(90));

  if (profitable.length === 0) {
    out.push('\nNo profitable segments found. Do not bet.');
    return out.join('\n');
  }

  out.push('');
  out.push('Conditions'.padEnd(22) + '| Line  | Dir   |  True P | Min Price | ROI    | Status');
  out.push('─'.repeat(90));

  for (const r of profitable) {
    const trueProb = r.hitRate;
    const minPrice = 1 / trueProb;

    let status: string;
    if (r.significant && r.n >= 200) {
      status = 'GO — bet live';
    } else if (r.significant && r.n >= 50) {
      status = 'PROMISING — paper trade';
    } else {
      status = 'WATCH — need more data';
    }

    out.push(
      `${r.label.padEnd(22)}| ${pad(String(r.line), 4)}  | ${r.direction.padEnd(5)} | ` +
      `${pad(pct(trueProb), 6)} | ${pad(minPrice.toFixed(3), 8)} | ` +
      `${pad(roiFmt(r.roi), 6)} | ${status}`,
    );
  }

  out.push('');
  out.push('GO criteria (ALL must pass):');
  out.push('  1. ROI > 0% at actual prices');
  out.push('  2. 95% CI lower bound > 0% (statistically significant)');
  out.push('  3. N >= 200');
  out.push('  4. Positive ROI in >= 60% of months (check monthly tables)');
  out.push('');
  out.push('How to use the Min Price column:');
  out.push('  If a soft book offers a price ABOVE Min Price for that line+direction → bet.');
  out.push('  Min Price = 1 / True Probability. Any price above it is +EV by definition.');

  return out.join('\n');
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

async function main() {
  const records: FirstSetRecord[] = JSON.parse(
    await readFile('data/dataset.json', 'utf-8'),
  );
  console.log(`Loaded ${records.length} records`);

  const report: string[] = [];
  report.push('# First-Set Total Games — Backtest Report');
  report.push(`Generated: ${new Date().toISOString()}`);
  report.push(`Records:   ${records.length}`);
  report.push(`Date range: ${records[0]?.date ?? '?'} -> ${records[records.length - 1]?.date ?? '?'}`);

  // ── 1. Distribution ──
  report.push(formatDistribution(records));

  // ── 2. Baseline ROI — all lines, both directions ──
  const baselineResults: ROIResult[] = [];
  for (const line of LINES) {
    for (const dir of ['Over', 'Under'] as const) {
      const r = computeROI(records, line, dir, 'ALL');
      if (r) baselineResults.push(r);
    }
  }
  report.push(formatROITable('BASELINE ROI — ALL MATCHES, ALL LINES', baselineResults));

  // ── 3. Segmented ROI — only for directions that show promise at baseline ──
  // Identify baseline-profitable (line, direction) pairs OR those close to profitable
  const candidatePairs = baselineResults.filter(r => r.roi > -0.02);

  // Define segments
  type SegmentDef = { name: string; filter: (r: FirstSetRecord) => boolean };
  const segments: SegmentDef[] = [
    { name: 'ATP', filter: r => classifyTour(r.league) === 'ATP' },
    { name: 'WTA', filter: r => classifyTour(r.league) === 'WTA' },
    { name: 'ATP Main', filter: r => classifyTour(r.league) === 'ATP' && classifyTier(r.league) === 'Main' },
    { name: 'ATP Challenger', filter: r => classifyTour(r.league) === 'ATP' && classifyTier(r.league) === 'Challenger' },
    { name: 'ATP ITF', filter: r => classifyTour(r.league) === 'ATP' && classifyTier(r.league) === 'ITF' },
    { name: 'WTA Main', filter: r => classifyTour(r.league) === 'WTA' && ['Main', 'Qualifiers'].includes(classifyTier(r.league)) },
    { name: 'WTA ITF', filter: r => classifyTour(r.league) === 'WTA' && classifyTier(r.league) === 'ITF' },
    { name: 'WTA 125K', filter: r => classifyTour(r.league) === 'WTA' && classifyTier(r.league) === '125K' },
    { name: 'R1-R3 (all)', filter: r => EARLY_ROUNDS.has(classifyRound(r.league)) },
    { name: 'QF+ (all)', filter: r => ['QF', 'SF', 'Final'].includes(classifyRound(r.league)) },
    { name: 'ATP R1-R3', filter: r => classifyTour(r.league) === 'ATP' && EARLY_ROUNDS.has(classifyRound(r.league)) },
    { name: 'WTA R1-R3', filter: r => classifyTour(r.league) === 'WTA' && EARLY_ROUNDS.has(classifyRound(r.league)) },
    { name: 'WTA Main R1-R3', filter: r => classifyTour(r.league) === 'WTA' && ['Main', 'Qualifiers'].includes(classifyTier(r.league)) && EARLY_ROUNDS.has(classifyRound(r.league)) },
    { name: 'ATP Chall R1-R3', filter: r => classifyTour(r.league) === 'ATP' && classifyTier(r.league) === 'Challenger' && EARLY_ROUNDS.has(classifyRound(r.league)) },
  ];

  const segResults: ROIResult[] = [];

  for (const { line, direction } of candidatePairs) {
    for (const seg of segments) {
      const filtered = records.filter(seg.filter);
      const r = computeROI(filtered, line, direction, seg.name);
      if (r) segResults.push(r);
    }
  }

  // Show all segmented results
  for (const { line, direction } of candidatePairs) {
    const results = segResults.filter(r => r.line === line && r.direction === direction);
    if (results.length > 0) {
      report.push(formatROITable(
        `SEGMENTED ROI — ${direction} ${line}`,
        results.sort((a, b) => b.roi - a.roi),
      ));
    }
  }

  // ── 4. Cross-line probability decomposition ──
  report.push(formatCrossLine(records));

  // Also by tour
  const atpRecs = records.filter(r => classifyTour(r.league) === 'ATP');
  const wtaRecs = records.filter(r => classifyTour(r.league) === 'WTA');
  if (atpRecs.length >= 100) report.push(formatCrossLine(atpRecs, 'ATP'));
  if (wtaRecs.length >= 100) report.push(formatCrossLine(wtaRecs, 'WTA'));

  // ── 5. Monthly consistency for profitable segments ──
  const profitableSegs = segResults.filter(r => r.roi > 0 && r.n >= 30);
  const uniquePairs = new Set(profitableSegs.map(r => `${r.line}|${r.direction}`));

  for (const pair of uniquePairs) {
    const [lineStr, dir] = pair.split('|');
    const line = Number(lineStr);
    const direction = dir as 'Over' | 'Under';
    report.push(formatMonthlyROI(records, line, direction));

    // Also per tour
    if (atpRecs.length >= 100) {
      const r = computeROI(atpRecs, line, direction, 'ATP');
      if (r && r.roi > 0) {
        report.push(formatMonthlyROI(atpRecs, line, direction));
      }
    }
    if (wtaRecs.length >= 100) {
      const r = computeROI(wtaRecs, line, direction, 'WTA');
      if (r && r.roi > 0) {
        report.push(formatMonthlyROI(wtaRecs, line, direction));
      }
    }
  }

  // ── 6. Opening vs Closing comparison ──
  // Only if opening prices exist in the data
  const hasOpening = records.some(r =>
    r.lines.some(l => l.opening_over && l.opening_over > 1),
  );
  if (hasOpening) {
    report.push(formatOpeningVsClosing(records));
  } else {
    report.push('\n(Opening prices not available in current dataset — re-extract to enable Opening vs Closing comparison)');
  }

  // ── 7. Decision table ──
  const allCandidates = [...baselineResults, ...segResults].filter(r => r.roi > 0);
  report.push(formatGoNoGo(allCandidates));

  // ── Output ──
  const reportText = report.join('\n');
  console.log(reportText);

  await mkdir('results', { recursive: true });
  await writeFile('results/analysis-report.txt', reportText);
  console.log('\n\nSaved -> results/analysis-report.txt');
}

main().catch(console.error);
