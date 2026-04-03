import { fetchArchivePage, fetchEventDetails, getSessionCount } from './pinnacle-client.js';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import type { FirstSetRecord, LineSnapshot } from './types.js';
import { VALID_SET_TOTALS } from './types.js';

const TENNIS_SPORT_ID = 2;    // Pinnacle tennis (API internal id, not p_id=33)
const START_AFTER = '2025-07-14';
const START_BEFORE = '2026-04-02';

// Optional caps for test runs: MAX_PAGES=3 MAX_DETAILS=30 npx tsx 01-extract.ts
const MAX_PAGES   = process.env.MAX_PAGES   ? Number(process.env.MAX_PAGES)   : 1000;
const MAX_DETAILS = process.env.MAX_DETAILS ? Number(process.env.MAX_DETAILS) : Infinity;

// Rate limiting and session cap are enforced inside pinnacle-client.ts.
// Sequential extraction is the only safe approach at 1K req/hour + 550 req/key.
// Script is resumable: already-cached events are skipped on re-run with new key.

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

// ── Phase A: Bulk archive extraction (paginated, one call per page) ──

async function extractArchive(): Promise<any[]> {
  const archivePath = 'data/archive-events.json';

  if (existsSync(archivePath)) {
    const cached = JSON.parse(await readFile(archivePath, 'utf-8'));
    console.log(`Archive loaded from cache: ${cached.length} events`);
    return cached;
  }

  console.log('Extracting archive events with is_have_periods=true...');
  const events: any[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    try {
      const raw = await fetchArchivePage(TENNIS_SPORT_ID, page, START_AFTER, START_BEFORE);
      const pageEvents = Array.isArray(raw) ? raw : (raw as any).events ?? [];
      if (pageEvents.length === 0) break;

      // Only "Games" events have game scores + first-set totals lines.
      // "Sets" events carry set-level results (1-0), not game scores.
      // "Games" events are always sub-events (parent_id != null) of "Sets" events.
      const withPeriods = pageEvents.filter(
        (e: any) => e.is_have_periods && e.resulting_unit === 'Games',
      );
      events.push(...withPeriods);
      console.log(`  Page ${page}: +${withPeriods.length} → total ${events.length} [session: ${getSessionCount()}]`);
      page++;
    } catch (err) {
      console.error(`  Page ${page} error: ${(err as Error).message}. Retrying in 5s...`);
      await sleep(5000);
    }
  }

  await writeFile(archivePath, JSON.stringify(events, null, 2));
  console.log(`\nArchive saved: ${events.length} events → data/archive-events.json`);
  return events;
}

// ── Phase B: Sequential details extraction (rate-limited inside client) ──
// At 1K req/hour + 550 req/key, sequential is the only viable approach.
// Rate enforcement and session cap live in pinnacle-client.ts.
// Script is resumable: re-run with new PINNACLE_RAPID_KEY after session cap.

async function extractDetails(events: any[]): Promise<void> {
  await mkdir('data/details', { recursive: true });

  const existing = new Set(
    existsSync('data/details')
      ? readdirSync('data/details').map((f: string) => f.replace('.json', ''))
      : [],
  );

  const pending = events
    .filter(e => !existing.has(String(e.event_id)))
    .map(e => e.event_id as number)
    .slice(0, MAX_DETAILS);

  console.log(`\nDetails: ${existing.size} cached, ${pending.length} to fetch`);
  console.log(`Estimated time: ~${((pending.length * 3.7) / 60).toFixed(0)} min at 1 req/3.7s`);

  if (pending.length === 0) {
    console.log('All details already cached.');
    return;
  }

  const startTime = Date.now();

  for (let i = 0; i < pending.length; i++) {
    const eid = pending[i];
    try {
      const details = await fetchEventDetails(eid);
      await writeFile(`data/details/${eid}.json`, JSON.stringify(details));
    } catch (err) {
      console.error(`  SKIP ${eid}: ${(err as Error).message}`);
      await sleep(5000); // Extra pause on error before retrying next
    }

    if ((i + 1) % 50 === 0 || i === pending.length - 1) {
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const rate = (i + 1) / ((Date.now() - startTime) / 1000);
      const eta = rate > 0 ? ((pending.length - i - 1) / rate / 60).toFixed(0) : '?';
      console.log(`  ${i + 1}/${pending.length} (${elapsed}m elapsed, ~${eta}m remaining, session: ${getSessionCount()})`);
    }
  }
}

// ── Phase C: Parse + validate → analysis-ready dataset ──

// Extract closing prices from any period's history.totals object.
// Works for both num_1 (first-set lines 8.5/9.5/10.5) and num_0 (match lines 16.5–24.5).
// Captures both opening (first entry) and closing (last entry) prices from history.
function extractLines(period: any): LineSnapshot[] {
  const histTotals = period.history?.totals;
  if (!histTotals || typeof histTotals !== 'object') return [];

  const snapshots: LineSnapshot[] = [];
  for (const lineStr of Object.keys(histTotals)) {
    const t = histTotals[lineStr];
    if (!t) continue;
    const overHistory: number[][] = t.over ?? [];
    const underHistory: number[][] = t.under ?? [];
    if (overHistory.length === 0 || underHistory.length === 0) continue;
    const closingOver = overHistory[overHistory.length - 1][1];
    const closingUnder = underHistory[underHistory.length - 1][1];
    if (!closingOver || !closingUnder || closingOver <= 1 || closingUnder <= 1) continue;
    const openingOver = overHistory[0][1];
    const openingUnder = underHistory[0][1];
    snapshots.push({
      line: Number(lineStr),
      closing_over: closingOver,
      closing_under: closingUnder,
      opening_over: openingOver,
      opening_under: openingUnder,
    });
  }
  // Sort by line value ascending
  return snapshots.sort((a, b) => a.line - b.line);
}

async function mergeDataset(events: any[]): Promise<FirstSetRecord[]> {
  console.log('\nMerging into analysis dataset...');
  const records: FirstSetRecord[] = [];
  const skips = { noDetail: 0, noPeriod: 0, noResult: 0, invalidTotal: 0, noLines: 0 };

  for (const event of events) {
    const eid = String(event.event_id);
    const detailPath = `data/details/${eid}.json`;
    if (!existsSync(detailPath)) { skips.noDetail++; continue; }

    let details: any;
    try {
      details = JSON.parse(await readFile(detailPath, 'utf-8'));
    } catch { skips.noDetail++; continue; }

    // Details response: { events: [{ periods: { num_0: {...}, num_1: {...} }, ... }] }
    const detailEvent = Array.isArray(details.events) ? details.events[0] : details;
    const set1Period = detailEvent?.periods?.num_1;
    // Require actual totals history — no totals history means market was never offered
    if (!set1Period?.history?.totals) { skips.noPeriod++; continue; }

    // Score comes from archive event.period_results (already in memory, same data).
    // period_results is embedded in archive response — no extra API call needed.
    const results: any[] = event.period_results ?? [];
    const set1Result = results.find((r: any) => r.number === 1);
    if (!set1Result) { skips.noResult++; continue; }

    const homeGames = Number(set1Result.team_1_score);
    const awayGames = Number(set1Result.team_2_score);
    const total = homeGames + awayGames;

    // Reject incomplete sets (retirements produce totals like 5, 7, etc. not in valid list)
    if (!(VALID_SET_TOTALS as readonly number[]).includes(total)) {
      skips.invalidTotal++;
      continue;
    }

    const lines = extractLines(set1Period);
    if (lines.length === 0) { skips.noLines++; continue; }

    // Match total (num_0 period result, number=0)
    const matchResult = results.find((r: any) => r.number === 0);
    const matchTotal = matchResult
      ? Number(matchResult.team_1_score) + Number(matchResult.team_2_score)
      : 0;

    // Match-level lines from num_0 (16.5–24.5 range) — same call, no extra API cost
    const matchPeriod = detailEvent?.periods?.num_0;
    const match_lines = extractLines(matchPeriod);

    records.push({
      event_id: event.event_id,
      date: (event.starts ?? '').slice(0, 10),
      league: event.league_name ?? event.league?.name ?? '',
      region: event.league_container ?? '',
      home: event.home?.name ?? event.home ?? '',
      away: event.away?.name ?? event.away ?? '',
      set1_home: homeGames,
      set1_away: awayGames,
      set1_total: total,
      match_total: matchTotal,
      lines,
      match_lines,
    });
  }

  // Sort chronologically
  records.sort((a, b) => a.date.localeCompare(b.date));

  await writeFile('data/dataset.json', JSON.stringify(records, null, 2));

  console.log('\n' + '─'.repeat(42));
  console.log(`Valid records:      ${records.length}`);
  console.log(`Skipped — no file:  ${skips.noDetail}`);
  console.log(`         no period: ${skips.noPeriod}`);
  console.log(`         no result: ${skips.noResult}`);
  console.log(`         bad total: ${skips.invalidTotal}  (retirements/walkovers)`);
  console.log(`         no lines:  ${skips.noLines}`);
  console.log('─'.repeat(42));
  console.log(`Saved → data/dataset.json`);

  return records;
}

// ── Main ──

async function main() {
  const events = await extractArchive();
  await extractDetails(events);
  const records = await mergeDataset(events);

  // Quick distribution sanity check
  console.log('\nDistribution check:');
  const dist = new Map<number, number>();
  for (const r of records) dist.set(r.set1_total, (dist.get(r.set1_total) ?? 0) + 1);
  for (const total of [6, 7, 8, 9, 10, 12, 13]) {
    const count = dist.get(total) ?? 0;
    const bar = '█'.repeat(Math.round((count / records.length) * 40));
    console.log(`  ${total}: ${String(count).padStart(4)} (${((count / records.length) * 100).toFixed(1)}%) ${bar}`);
  }
  if (dist.has(11)) console.error('BUG: total=11 found in dataset (impossible)');
  else console.log('  No total=11 (correct)');
}

main().catch(console.error);
