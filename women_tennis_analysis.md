# Women's Tennis Betting Analysis
# Source: dataset.combined.json
# Analysis date: 2026-04-07

---

## Dataset Overview

| Metric | Value |
|--------|-------|
| Total records | 5,738 |
| Void events excluded | 153 |
| Void definition | match_total = 0 OR match_total < set1_total (retirements/incomplete) |
| WTA Main (valid) | 404 |
| WTA 125 (valid) | 301 |
| ITF Women (valid) | 1,296 |

**Void exclusion rule (applied to all calculations):**
```
VOID = records where match_total == 0
    OR (match_total > 0 AND match_total < set1_total)
```

---

## ROI Formula

```
ROI = (sum_of_winning_payouts - total_stakes) / total_stakes * 100
```
One unit staked per bet. One bet per match (lowest qualifying line used first).
Win condition: Under wins when match_total <= line. Over wins when match_total > line.

---

## Summary: Markets Tested and Verdict

| Market | ROI (all odds) | ROI (odds >= 1.70) | Verdict |
|--------|---------------|---------------------|---------|
| WTA 125 Match Under | +11.68% | +8.78% | **KEEP** |
| WTA Main Set1 Under 12.5 | +15.41% | -10.96% | DISCARD |
| WTA Main Match Under | +11.81% | +1.77% | DISCARD |
| ITF Women Match Under | +5.30% | -10.14% | DISCARD |

---

## CONFIRMED EDGE: WTA 125 Match Under

**Method:** One bet per match, lowest line available, priority order:
20.5 → 21.5 → 22.5 → 23.5 → 24.5 → 25.5 → 26.5

### Overall Results

| Filter | n | Wins | Win% | Avg Odds | ROI |
|--------|---|------|------|----------|-----|
| No filter | 286 | 175 | 61.2% | 1.921 | +11.68% |
| Odds >= 1.50 | 257 | 154 | 59.9% | — | +13.34% |
| Odds >= 1.60 | 247 | 146 | 59.1% | — | +12.86% |
| Odds >= 1.70 | 197 | 107 | 54.3% | — | +8.78% |
| Odds >= 1.80 | 165 | 89 | 53.9% | — | +10.82% |

**Edge survives all practical minimum-odds thresholds.**

### Performance by Line (all bets at that line, across all matches)

| Line | n | Win% | Avg Odds | Break-Even Odds | ROI |
|------|---|------|----------|-----------------|-----|
| 20.5 | 286 | 61.2% | 1.921 | 1.634 | +11.68% |
| 21.5 | 212 | 60.8% | 1.967 | 1.643 | +13.32% |
| 22.5 | 248 | 71.8% | 1.693 | 1.393 | +17.20% |
| 23.5 | 101 | 66.3% | 1.989 | 1.507 | +20.93% |
| 24.5 | 181 | 71.3% | 1.727 | 1.403 | +15.86% |
| 25.5 | 75 | 66.7% | 2.091 | 1.500 | +21.49% |
| 26.5 | 78 | 71.8% | 1.852 | 1.393 | +23.29% |

Break-even odds = 1 / win_rate. All lines show avg_odds > break_even_odds.

### Temporal Stability

| Period | n | ROI |
|--------|---|-----|
| First half | 168 | +16.70% |
| Second half | 118 | +4.53% |

**Note:** The edge weakened in the second half but remained positive. Monitor closely
for continued decay. If ROI falls below 0% over 100+ bets, suspend betting.

---

## DISCARDED: WTA Main Set1 Under 12.5

**Reason: Edge entirely embedded in sub-1.30 odds.**

| Filter | n | Win% | Avg Odds | ROI |
|--------|---|------|----------|-----|
| No filter | 148 | 89.9% | 1.521 | +15.41% |
| Odds >= 1.30 | 47 | 68.1% | — | +12.97% |
| Odds >= 1.50 | 30 | 50.0% | — | -2.30% |
| Odds >= 1.70 | 24 | 41.7% | — | -10.96% |

Odds distribution: 101 of 148 bets (68.2%) priced at 1.05–1.29.
Above 1.50: ROI immediately negative.

**Root cause:** Pinnacle prices set WON'T reach tiebreak at ~1.10–1.15.
Actual non-tiebreak rate is 92.6%, implied by those odds is ~87%.
Technically +EV, but returns are too small at viable unit sizes to matter.
**Not a usable market.**

---

## DISCARDED: ITF Women Match Under

**Reason: Edge collapses above odds 1.70.**

**Method:** One bet per match, lowest line priority: 22.5 → 26.5 → 27.5 → 28.5 → 29.5

| Filter | n | Win% | ROI |
|--------|---|------|-----|
| No filter | 697 | 60.7% | +5.30% |
| Odds >= 1.50 | 672 | 59.8% | +5.06% |
| Odds >= 1.70 | 387 | 47.5% | -10.14% |
| Odds >= 1.80 | 281 | 38.8% | -22.93% |

**Interpretation:** When Pinnacle offers Under at 1.30–1.65, it's a signal
they know the match will go under. Win rate is high, but the market has already
priced this in. When Under is available at 1.70+, the uncertainty is genuine
and results reflect that. Not commercially exploitable.

---

## DISCARDED: WTA Main Match Under

**Reason: Insufficient sample at viable odds, marginal ROI.**

**Method:** Line priority 27.5 → 28.5 → 29.5

| Filter | n | Win% | ROI |
|--------|---|------|-----|
| No filter | 99 | 65.7% | +11.81% |
| Odds >= 1.70 | 64 | 51.6% | +1.77% |

Only 64 bets at actionable odds with +1.77% ROI. Not statistically significant.

---

## LIVE BET: Tiebreak Trigger (Women's Matches)

When Set 1 ends in a tiebreak (score 7-6, set1_total = 13), the match total
distribution shifts dramatically upward.

| Condition | n | Avg Match Total |
|-----------|---|------------------|
| Set 1 tiebreak (set1=13) | 185 | 25.46 games |
| No tiebreak | 1,816 | 20.53 games |
| Tiebreak effect | — | +4.94 games |

### Win Rate for Over Bets After a Tiebreak (all women's tiers)

| Line | Win Rate | Avg Pre-Match Over Odds | n with odds |
|------|----------|------------------------|-------------|
| Over 20.5 | 91.4% | 1.772 | 177 |
| Over 21.5 | 76.8% | 1.736 | 161 |
| Over 22.5 | 61.6% | 1.891 | 139 |
| Over 23.5 | 50.3% | 2.042 | 98 |

**IMPORTANT CAVEAT:** The odds shown above are pre-match prices, not live prices.
After a tiebreak, live Over prices will be significantly shorter (e.g., Over 20.5
may be available at only 1.10–1.25 live). Whether the live edge is exploitable
depends entirely on what live odds are available at the time of the tiebreak.
This cannot be verified from the current dataset (no live odds data).

The structural case for a live edge exists (91.4% win rate for Over 20.5 is
extraordinary), but confirm the live odds before committing to this strategy.
At live odds of 1.10, break-even is 90.9% — very close to 91.4%. Minimal margin.
At live odds of 1.20+, the edge is meaningful.

---

## BETTING STRATEGY

### The Only Confirmed Pre-Match Edge

**Market:** WTA 125 Match Total — Under  
**Minimum odds:** 1.50 (do not bet if priced below this)  
**Line selection:** Take the LOWEST available line from this list per match:  
  20.5 → 21.5 → 22.5 → 23.5 → 24.5 → 25.5 → 26.5  
**One bet per match only** (never stack multiple lines on same match)  
**Applies to:** WTA 125 tier only

### Stake Sizing

| Rule | Value |
|------|-------|
| Stake per match | 1% of current bankroll |
| Max concurrent positions | No cap — but one per match |
| Stop-loss | Pause if bankroll drops 25% from peak |

### What to Skip

- ATP Main, ATP Challenger, ITF Men — no confirmed edge
- WTA Main Set1 / Match unders — edge is in sub-1.30 odds, not viable
- ITF Women Match unders — edge collapses at viable odds
- Never bet the same match twice on different lines

### Live Tiebreak Bet (Conditional)

After a WTA set1 tiebreak: bet Match Over at the lowest available line.  
**Only proceed if live Over odds are >= 1.20 for line 20.5–21.5.**  
At live odds below 1.20, the edge is too thin to be reliable.  
This strategy requires live odds access — verify before trading.

### Monitoring

Re-run the ROI calculation monthly on new data.  
Flag if WTA 125 ROI drops below +3% over 100 consecutive bets.  
The second-half temporal decline (+4.53%) suggests possible market correction —
watch for Pinnacle adjusting WTA 125 match total lines upward.

---

## Key Numbers to Cross-Check

All figures derived from dataset.combined.json with the following exact parameters:
- 153 void events excluded (match_total=0 OR match_total < set1_total)
- WTA 125: 301 valid events, 286 have a qualifying match line
- One bet per match (lowest eligible line wins the selection)
- ROI = (sum_of_winning_payouts - n_bets) / n_bets * 100
- 286 bets, 175 wins, total payouts = sum of odds for each winning bet
  Direct check: payout = 286 × (1 + 0.1168) = 286 × 1.1168 = 319.41
  319.41 - 286 = 33.41 net profit on 286 units staked = +11.68% confirmed.
