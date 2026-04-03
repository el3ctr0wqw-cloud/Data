import { readFile, writeFile } from 'node:fs/promises';
import type { FirstSetRecord, LineAnalysis } from './types.js';
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

function zScore(observed: number, expected: number, n: number): number {
  if (n === 0 || expected <= 0 || expected >= 1) return 0;
  const se = Math.sqrt(expected * (1 - expected) / n);
  return se > 0 ? (observed - expected) / se : 0;
}

// ═══════════════════════════════════════════
// CORE ANALYSIS
// ═══════════════════════════════════════════

function analyzeByLine(records: FirstSetRecord[], targetLine: number): LineAnalysis {
  let n = 0;
  let overHits = 0;
  let sumImpliedOver = 0;
  let sumImpliedUnder = 0;
  let sumVig = 0;

  for (const rec of records) {
    const snap = rec.lines.find(l => l.line === targetLine);
    if (!snap) continue;

    n++;
    const { fairOver, fairUnder, vig } = removeVig(snap.closing_over, snap.closing_under);
    sumImpliedOver += fairOver;
    sumImpliedUnder += fairUnder;
    sumVig += vig;

    if (rec.set1_total > targetLine) overHits++;
  }

  const underHits = n - overHits;
  const overRate = n > 0 ? overHits / n : 0;
  const underRate = n > 0 ? underHits / n : 0;
  const avgIO = n > 0 ? sumImpliedOver / n : 0;
  const avgIU = n > 0 ? sumImpliedUnder / n : 0;
  const avgVig = n > 0 ? sumVig / n : 0;

  return {
    line: targetLine,
    n,
    over_hits: overHits,
    under_hits: underHits,
    over_rate: overRate,
    under_rate: underRate,
    avg_implied_over: avgIO,
    avg_implied_under: avgIU,
    edge_over: overRate - avgIO,
    edge_under: underRate - avgIU,
    z_over: zScore(overRate, avgIO, n),
    z_under: zScore(underRate, avgIU, n),
    avg_vig: avgVig,
  };
}

// ═══════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════

const pct = (v: number) => (v * 100).toFixed(1) + '%';
const edgeFmt = (v: number) => (v >= 0 ? '+' : '') + (v * 100).toFixed(2) + '%';
const pad = (s: string, w: number) => s.padStart(w);

function formatLineTable(title: string, analyses: LineAnalysis[]): string {
  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(102));
  out.push(title);
  out.push('═'.repeat(102));
  out.push(
    'Line  |    N | Over%  | Fair O | Edge O  |  z(O) | Under% | Fair U | Edge U  |  z(U) |  Vig',
  );
  out.push('─'.repeat(102));

  for (const a of analyses) {
    const sigO = Math.abs(a.z_over) >= 1.96 ? '*' : ' ';
    const sigU = Math.abs(a.z_under) >= 1.96 ? '*' : ' ';
    out.push(
      ` ${pad(String(a.line), 4)} | ${pad(String(a.n), 4)} | ` +
      `${pad(pct(a.over_rate), 5)} | ${pad(pct(a.avg_implied_over), 5)} | ` +
      `${pad(edgeFmt(a.edge_over), 6)}${sigO} | ${pad(a.z_over.toFixed(2), 5)} | ` +
      `${pad(pct(a.under_rate), 5)} | ${pad(pct(a.avg_implied_under), 5)} | ` +
      `${pad(edgeFmt(a.edge_under), 6)}${sigU} | ${pad(a.z_under.toFixed(2), 5)} | ` +
      `${pad(pct(a.avg_vig), 4)}`,
    );
  }
  out.push('  (* = statistically significant at p < 0.05, |z| >= 1.96)');
  return out.join('\n');
}

// ═══════════════════════════════════════════
// DISTRIBUTION
// ═══════════════════════════════════════════

function formatDistribution(records: FirstSetRecord[]): string {
  const dist = new Map<number, number>();
  for (const r of records) dist.set(r.set1_total, (dist.get(r.set1_total) ?? 0) + 1);

  const scoreLabels: Record<number, string> = {
    6: '6-0', 7: '6-1', 8: '6-2', 9: '6-3',
    10: '6-4', 12: '7-5', 13: '7-6(TB)',
  };

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
      `   ${pad(String(total), 2)} | ${pad(scoreLabels[total] ?? '?', 8)} | ` +
      `${pad(String(count), 5)} | ${pad(pct(p), 5)} | ${pad(pct(cumulative), 5)} | ${bar}`,
    );
  }

  const sum = records.reduce((s, r) => s + r.set1_total, 0);
  out.push(`\nTotal records: ${records.length}`);
  out.push(`Mean total:    ${(sum / records.length).toFixed(2)}`);
  return out.join('\n');
}

// ═══════════════════════════════════════════
// SEGMENTATION
// ═══════════════════════════════════════════

function classifyTour(league: string): 'ATP' | 'WTA' | 'MIXED' {
  const l = league.toUpperCase();
  if (l.includes('WTA') || l.includes('WOMEN')) return 'WTA';
  if (l.includes('ATP') || l.includes('CHALLENGER')) return 'ATP';
  if (/AUSTRALIAN|ROLAND\s+GARROS|WIMBLEDON|US\s+OPEN/i.test(l)) return 'MIXED';
  return 'ATP';
}

function formatMonthlyConsistency(records: FirstSetRecord[], targetLine: number): string {
  const months = new Map<string, FirstSetRecord[]>();
  for (const rec of records) {
    const m = rec.date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(rec);
  }

  const out: string[] = [];
  out.push(`\nMonthly consistency — line ${targetLine}:`);
  out.push('Month    |    N | Over%  | Edge O  | Under% | Edge U');
  out.push('─'.repeat(62));

  const sorted = [...months.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let overPos = 0, underPos = 0, validMonths = 0;

  for (const [month, recs] of sorted) {
    const a = analyzeByLine(recs, targetLine);
    if (a.n < 10) {
      out.push(`${month} | ${pad(String(a.n), 4)} |  (skipped — N < 10)`);
      continue;
    }
    validMonths++;
    if (a.edge_over > 0) overPos++;
    if (a.edge_under > 0) underPos++;
    out.push(
      `${month} | ${pad(String(a.n), 4)} | ` +
      `${pad(pct(a.over_rate), 5)} | ${pad(edgeFmt(a.edge_over), 6)} | ` +
      `${pad(pct(a.under_rate), 5)} | ${pad(edgeFmt(a.edge_under), 6)}`,
    );
  }
  const needed = Math.ceil(validMonths * 0.6);
  out.push(`\nOver  edge positive: ${overPos}/${validMonths} months  (need >=${needed} for 60% consistency)`);
  out.push(`Under edge positive: ${underPos}/${validMonths} months  (need >=${needed} for 60% consistency)`);
  return out.join('\n');
}

// ═══════════════════════════════════════════
// SCORE BREAKDOWN
// ═══════════════════════════════════════════

function formatScoreBreakdown(records: FirstSetRecord[]): string {
  const scoreLabels: Record<number, string> = {
    6: '6-0', 7: '6-1', 8: '6-2', 9: '6-3',
    10: '6-4', 12: '7-5', 13: '7-6(TB)',
  };

  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(62));
  out.push('SCORE BREAKDOWN BY LINE');
  out.push('═'.repeat(62));

  for (const line of LINES) {
    out.push(`\nLine ${line}:`);
    const overScores = VALID_SET_TOTALS.filter(t => t > line);
    const underScores = VALID_SET_TOTALS.filter(t => t < line);

    out.push(`  Over  (scores ${overScores.map(t => scoreLabels[t]).join(', ')}):`);
    for (const t of overScores) {
      const count = records.filter(r => r.set1_total === t).length;
      out.push(`    ${scoreLabels[t]}: ${count} (${pct(count / records.length)} of all)`);
    }

    out.push(`  Under (scores ${underScores.map(t => scoreLabels[t]).join(', ')}):`);
    for (const t of underScores) {
      const count = records.filter(r => r.set1_total === t).length;
      out.push(`    ${scoreLabels[t]}: ${count} (${pct(count / records.length)} of all)`);
    }
  }
  return out.join('\n');
}

// ═══════════════════════════════════════════
// GO / NO-GO VERDICT
// ═══════════════════════════════════════════

function goNoGoVerdict(analyses: LineAnalysis[]): string {
  let bestLine = 0, bestSide = '', bestEdge = 0, bestZ = 0, bestN = 0;

  for (const a of analyses) {
    if (Math.abs(a.edge_over) > Math.abs(bestEdge)) {
      bestLine = a.line; bestSide = 'Over'; bestEdge = a.edge_over; bestZ = a.z_over; bestN = a.n;
    }
    if (Math.abs(a.edge_under) > Math.abs(bestEdge)) {
      bestLine = a.line; bestSide = 'Under'; bestEdge = a.edge_under; bestZ = a.z_under; bestN = a.n;
    }
  }

  const out: string[] = [];
  out.push('');
  out.push('═'.repeat(62));
  out.push('GO / NO-GO DECISION');
  out.push('═'.repeat(62));
  out.push(`\nBest candidate: ${bestSide} ${bestLine}`);
  out.push(`  Edge: ${edgeFmt(bestEdge)}  |  z: ${bestZ.toFixed(2)}  |  N: ${bestN}`);
  out.push('');

  const edgeOk = Math.abs(bestEdge) > 0.03;
  const sampleOk = bestN >= 100;
  const sigOk = Math.abs(bestZ) >= 1.96;

  out.push(`${edgeOk ? '[YES]' : '[NO] '} 1. Edge > 3%          ${edgeFmt(bestEdge)}`);
  out.push(`${sampleOk ? '[YES]' : '[NO] '} 2. Sample >= 100       N = ${bestN}`);
  out.push(`${sigOk ? '[YES]' : '[NO] '} 3. |z| >= 1.96         z = ${bestZ.toFixed(2)}`);
  out.push(`[???] 4. Monthly consistency  see tables above`);
  out.push(`[???] 5. 1xbet availability   check manually`);

  const passed = [edgeOk, sampleOk, sigOk].filter(Boolean).length;
  out.push(`\nQuantitative checks: ${passed}/3`);

  if (passed === 3) {
    out.push('\n-> PROCEED: Edge is real and measurable.');
    out.push('  Next: verify monthly consistency, confirm 1xbet availability,');
    out.push('  paper-trade 50 matches before staking.');
  } else if (passed >= 2) {
    out.push('\n-> PROMISING but not conclusive.');
    out.push('  Signal exists but is too small or noisy for staking.');
    out.push('  Options: wait for more data, investigate ATP or WTA segment only.');
  } else {
    out.push('\n-> REJECT: No exploitable edge detected.');
    out.push('  Pinnacle prices this market efficiently.');
    out.push('  Do not invest further time in first-set totals.');
  }

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

  // 1. Distribution
  report.push(formatDistribution(records));

  // 2. Baseline (all matches)
  const baseline = LINES.map(l => analyzeByLine(records, l));
  report.push(formatLineTable('BASELINE — ALL MATCHES', baseline));

  // 3. Tour split
  const tourGroups = new Map<string, FirstSetRecord[]>();
  for (const rec of records) {
    const tour = classifyTour(rec.league);
    if (!tourGroups.has(tour)) tourGroups.set(tour, []);
    tourGroups.get(tour)!.push(rec);
  }
  for (const [tour, recs] of tourGroups) {
    const tourAnalyses = LINES.map(l => analyzeByLine(recs, l));
    report.push(formatLineTable(`SEGMENT — ${tour} (N=${recs.length})`, tourAnalyses));
  }

  // 4. Monthly consistency per line
  for (const line of LINES) {
    report.push(formatMonthlyConsistency(records, line));
  }

  // 5. Score breakdown
  report.push(formatScoreBreakdown(records));

  // 6. Go/No-Go
  report.push(goNoGoVerdict(baseline));

  const reportText = report.join('\n');
  console.log(reportText);
  await writeFile('results/analysis-report.txt', reportText);
  console.log('\n\nSaved -> results/analysis-report.txt');
}

main().catch(console.error);
