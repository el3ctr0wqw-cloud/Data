# First-Set Totals — Review Findings & Phase 2 Plan

**Date:** 2026-04-03
**Status:** Phase 1 review complete. Ready for Phase 2 implementation.
**Dataset:** 2,358 records (Mar 22 – Apr 1, 2026). ~12% of available data extracted.

---

## Part 1: What the Review Found

### The headline: the current analysis asks the wrong question

`02-analyze.ts` computes **edge vs de-vigged fair odds** and declares a GO if that edge is >3% with z>1.96. But you can't bet at de-vigged prices. When we compute **actual ROI at Pinnacle closing prices** (stake $1 on Under, receive `closing_under` if win, lose $1 if not), the results flip:

| Line | Edge vs Fair | ROI at Actual Prices | Verdict |
|------|-------------|---------------------|---------|
| Under 8.5 | -0.54% | **-21.3%** | Dead |
| Under 9.5 | +2.96% | **-24.7%** | Dead |
| Under 10.5 | +5.06% | **-1.0%** | Marginal — vig eats the edge |
| Under 12.5 | not tested | **+3.9%** | Profitable — line was never analyzed |

The report says "PROCEED" on Under 10.5. It actually loses money. Meanwhile Under 12.5 — a line the script completely ignores — is the only baseline-profitable play.

### Lines that actually make money at real prices

Tested at Pinnacle closing prices, flat $1 stake on Under:

| Segment | U10.5 ROI | U10.5 N | U12.5 ROI | U12.5 N |
|---------|-----------|---------|-----------|---------|
| **WTA Main** | **+6.9%** | 203 | **+18.7%** | 69 |
| **WTA ITF** | +0.9% | 520 | **+10.8%** | 131 |
| **WTA all** | +2.1% | 784 | **+11.9%** | 213 |
| **ATP Challenger** | -3.3% | 750 | **+5.7%** | 473 |
| ATP Main | -3.8% | 150 | -9.5% | 122 |
| ATP ITF | -4.4% | 471 | -3.1% | 179 |

95% confidence intervals (ROI):
- WTA Main U12.5: [+7.95%, +29.45%] — **significant**
- WTA ITF U12.5: [+2.51%, +18.98%] — **significant**
- WTA all U12.5: [+5.38%, +18.43%] — **significant**
- ATP Challenger U12.5: [+0.60%, +10.87%] — **significant**
- WTA Main U10.5: [+0.01%, +13.74%] — barely significant
- WTA all U10.5: [-1.36%, +5.48%] — not significant

### Why the market is wrong: tiebreak overestimation

Cross-line probability analysis reveals Pinnacle systematically overestimates the chance of tight sets:

```
P(total=9,  i.e., 6-3): actual 22.8% vs implied 16.0%  → market underestimates by 6.8pp
P(total=10, i.e., 6-4): actual 22.5% vs implied 15.1%  → market underestimates by 7.4pp
```

The market prices too many 7-5 and 7-6 outcomes. Sets are more "middle-heavy" (6-3, 6-4) than Pinnacle models. This explains why Under 12.5 (bet against tiebreak) and Under 10.5 (bet against 7-5 and 7-6) show edges.

### Favorite-longshot bias is present

Whichever side is the heavy favorite outperforms its implied probability:
- When Under 10.5 is favorite (fairUnder >= 50%): actual 84.1% vs implied 77.7%
- When Over 10.5 is favorite (fairOver >= 50%): actual 79.3% vs implied 70.8%

Both favorites beat the market. This is classic FLB — longshots are overpriced. This affects interpretation: part of the "Under edge" on 10.5 is just FLB on the favorite side, not a tennis-specific signal.

### Code bugs and gaps found

| ID | Issue | File | Fix |
|----|-------|------|-----|
| C1 | `LINES` constant is `[8.5, 9.5, 10.5]` — misses 12.5, 6.5, 7.5 | types.ts | Add all extracted lines |
| C2 | No ROI calculation anywhere — only edge vs fair odds | 02-analyze.ts | Add ROI simulation (see Part 2) |
| C3 | Z-score uses `sqrt(p*(1-p)/n)` with average implied p. Should use per-match empirical SE: `std(outcome_i - fair_i) / sqrt(n)` | 02-analyze.ts:20-24 | Current method understates z (conservative), but fix for correctness |
| C4 | Grand Slam classifier will assign matches to "MIXED" instead of ATP/WTA when data expands | 02-analyze.ts:152-158 | Need player-name or parent-event gender lookup |
| C5 | Opening prices not extracted — only closing | 01-extract.ts:114-131 | Extract first entry in history array alongside last |

---

## Part 2: Phase 2 Implementation Plan

### Goal

Build a segmented decision engine: **for a given match, determine which line (if any) to play, in which direction, and what the expected true probability is.**

The analysis framework centers on **ROI at actual prices**, not edge vs fair odds. A signal is only actionable if flat-betting it at the book's offered price produces positive ROI after vig.

### Step 0: Scale the dataset

**Current:** 2,358 records, 11 days, ~12% of available data.
**Target:** ~19,000 records, Jul 2025 – Apr 2026 (full archive).

The extract pipeline (`01-extract.ts`) is already resumable — re-run with new API keys to continue fetching details. Budget: ~40 keys total for full extraction.

**Priority:** Get to at least 5,000–8,000 records before heavy analysis. The WTA Main U12.5 finding (N=69) needs 5x more data to be trustworthy.

After extracting more data, re-run the merge step to rebuild `dataset.json`.

### Step 1: Fix the extract pipeline

Modify `01-extract.ts` `extractClosingLines()` to also capture **opening prices**:

```ts
// Current: only captures closing (last entry)
const overPrice = overHistory[overHistory.length - 1][1];

// Add: also capture opening (first entry)  
const openingOver = overHistory[0][1];
const openingUnder = underHistory[0][1];
```

Update the `LineSnapshot` type:
```ts
interface LineSnapshot {
  line: number;
  closing_over: number;
  closing_under: number;
  opening_over: number;   // NEW
  opening_under: number;  // NEW
}
```

Update `FirstSetRecord` to include `league_container` (geography) from the archive event for later segmentation:
```ts
interface FirstSetRecord {
  // ... existing fields ...
  region: string;  // NEW — from event.league_container
}
```

### Step 2: Rewrite the analysis script

Replace `02-analyze.ts` with a new analysis that is structured around **three layers**:

#### Layer 1: Baseline ROI table

For every `(line, direction)` pair, compute:
- N (sample size)
- Hit rate (actual outcome frequency)  
- ROI at closing prices: `sum(won ? price - 1 : -1) / N`
- 95% CI on ROI using empirical standard error
- Mark significant if CI lower bound > 0

Lines to test: `[6.5, 7.5, 8.5, 9.5, 10.5, 12.5]`, both Over and Under.

#### Layer 2: Segmented ROI

Break down every baseline-profitable `(line, direction)` by these dimensions:

| Dimension | Segments |
|-----------|----------|
| Tour | ATP, WTA |
| Tier | Main, Challenger, ITF, 125K, Qualifiers |
| Round | R1, R2, R3, R16, QF, SF, Final |
| Region | from `league_container` |
| Implied probability bucket | [0-20%), [20-30%), [30-40%), [40-50%), [50%+) based on fair implied prob of the side being bet |
| Month | YYYY-MM for temporal consistency |

For each segment, compute the same ROI + CI as Layer 1. Only report segments with N >= 30.

#### Layer 3: Conditional filters (compound segments)

Test combinations that Phase 1 research identified as strong:
- WTA + Main + R1-R2
- WTA + ITF + R1
- ATP + Challenger + R1-R2
- Any tour + heavy favorite (fair prob >= 75% for the side bet)

For each, compute ROI + CI. These are the candidate **betting rules**.

#### Layer 4: Cross-line probability decomposition

For records that have multiple lines, compute:
```
P(total = 9)  = P(over 8.5) - P(over 9.5)     [implied]  vs  actual frequency
P(total = 10) = P(over 9.5) - P(over 10.5)     [implied]  vs  actual frequency  
P(total = 12) = P(over 10.5) - P(over 12.5)    [implied]  vs  actual frequency
P(total = 13) = P(over 12.5)                    [implied]  vs  actual frequency
```

This reveals which specific scorelines the market misprices most. Segment this by tour (ATP vs WTA) — the mispricing pattern may differ.

#### Layer 5: Opening vs closing price analysis (once Step 1 data is available)

For each profitable segment:
- Compare opening vs closing prices: did the line move toward Under or Over?
- Compute ROI at **opening prices** (since user bets pre-match, this is the realistic entry)
- Compute CLV (Closing Line Value): `closing_fair / opening_fair - 1`
  - Positive CLV = you got a better price than closing = strong signal
  - Negative CLV = line moved against you = weak signal

This determines whether pre-match entry is better or worse than closing.

### Step 3: Fix the z-score

Replace the current z-score function:

```ts
// CURRENT (incorrect for heterogeneous implied probabilities)
function zScore(observed: number, expected: number, n: number): number {
  const se = Math.sqrt(expected * (1 - expected) / n);
  return (observed - expected) / se;
}

// CORRECT (per-match empirical SE)
function zScoreEmpirical(edges: number[]): number {
  const n = edges.length;
  if (n < 2) return 0;
  const mean = edges.reduce((a, b) => a + b, 0) / n;
  const variance = edges.reduce((a, e) => a + (e - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  return se > 0 ? mean / se : 0;
}
```

Where `edges[i] = outcome_i - fair_implied_i` (1 or 0 minus the de-vigged probability for each match).

### Step 4: Fix the tour classifier

The current classifier will break on Grand Slams. Options:

**Option A (quick):** Use the `parent_id` to look up the parent "Sets" event's league name, which may have tour info. If not, use a hardcoded list of known Grand Slam event IDs or date ranges.

**Option B (robust):** Maintain a mapping file `league_id -> tour` built from the archive data. Most league names contain "ATP" or "WTA" except Grand Slams and some exhibition events. For ambiguous ones, check if the `home` player name appears in ATP or WTA player databases.

**Option C (practical):** For Grand Slams, check if the player names contain "(Games)" suffix (they all do in this API). Then look up whether the player is male or female using a simple name-gender database or by cross-referencing with the JeffSackmann player files already in the repo (`tennis_atp/atp_players.csv`, `tennis_wta/wta_players.csv`).

### Step 5: Update the go/no-go framework

Replace the current edge-based GO/NO-GO with ROI-based criteria:

```
GO criteria (ALL must pass):
1. ROI > 0% at actual closing prices
2. 95% CI lower bound > 0% (statistically significant)
3. N >= 200 (sufficient sample)
4. Monthly consistency: positive ROI in >= 60% of months with N >= 30
5. ROI at opening prices also > 0% (realistic entry point)
```

```
PROMISING (investigate further):
- ROI > 0% but CI crosses zero
- OR N < 200 but CI lower bound > 0%
- Action: collect more data before betting
```

```
REJECT:
- ROI <= 0% at actual prices regardless of edge vs fair
- Action: do not bet this line/segment
```

### Step 6: Output format

The final report should have these sections:

```
1. DATASET SUMMARY
   - Record count, date range, tour split, tier split
   - Score distribution (sanity check)

2. BASELINE ROI TABLE
   - All lines × both directions
   - ROI, CI, significance flag

3. PROFITABLE SEGMENTS
   - For each baseline-profitable (line, direction):
     - Segmented by tour, tier, round, region, month
     - ROI + CI per segment
     - Only show N >= 30

4. COMPOUND FILTERS (best candidates)
   - Top 10 segment combinations by ROI where CI > 0
   - Ranked by: ROI × sqrt(N) (reward both edge size and reliability)

5. CROSS-LINE DECOMPOSITION
   - Implied vs actual P(scoreline) per tour
   - Which specific scores are mispriced

6. TEMPORAL CONSISTENCY
   - Monthly ROI for each profitable segment
   - Rolling 30-day hit rate chart (text-based)

7. DECISION TABLE
   - Final output: "If [conditions], bet [direction] [line]"
   - Expected true probability for each rule
   - Required minimum soft-book price to be +EV
```

---

## Part 3: What Success Looks Like

The end product is a **lookup table**:

| Conditions | Line | Direction | True Prob | Min Price for +EV |
|------------|------|-----------|-----------|-------------------|
| WTA Main, R1-R2 | 12.5 | Under | ~90% | > 1.111 |
| WTA ITF, R1 | 12.5 | Under | ~88% | > 1.136 |
| ATP Challenger, R1-R2 | 12.5 | Under | ~83% | > 1.205 |
| WTA Main, R1-R3 | 10.5 | Under | ~85% | > 1.176 |

*(Values above are illustrative — actual values come from the expanded dataset)*

When you see a match on a soft book, you:
1. Identify the conditions (tour, tier, round)
2. Look up which line and direction to play
3. Check if the soft book's offered price exceeds the minimum
4. If yes → bet. If no → skip.

The "true probability" column is the actual hit rate from historical data for that segment. The "min price" is `1 / true_probability`. Any price above that is +EV by definition.

---

## Part 4: File Structure

```
Data/
  01-extract.ts          ← modify: add opening prices + region
  02-analyze.ts          ← rewrite per Layer 1-6 above  
  types.ts               ← update: add opening prices, expand LINES
  dataset.json           ← rebuild after extract changes
  REFERENCE.md           ← keep as-is (API reference)
  REVIEW_AND_PLAN.md     ← this file
  results/
    analysis-report.txt  ← regenerated by new 02-analyze.ts
```

---

## Part 5: Order of Operations

```
1. Update types.ts — add opening prices, expand LINES to [6.5, 7.5, 8.5, 9.5, 10.5, 12.5]
2. Update 01-extract.ts — capture opening prices + league_container
3. Rebuild dataset.json (re-run extract merge on existing cached details)
4. Rewrite 02-analyze.ts with Layers 1-6
5. Run analysis, review output
6. Continue data collection (more API keys → more records)
7. Re-run analysis at 5K, 10K, 15K, 19K records — watch for convergence
```

Steps 1-4 can be done immediately on current data. Steps 6-7 are ongoing as more data is collected.
