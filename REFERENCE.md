# First-Set Totals Backtest — Reference Sheet
_Last updated: 2026-04-02_

---

## API Endpoints

| Purpose | Endpoint |
|---|---|
| List events | `GET /kit/v1/archive?sport_id=2&page_num=N&start_after=YYYY-MM-DD&start_before=YYYY-MM-DD` |
| Event details | `GET /kit/v1/details?event_id=XXX` |
| Sports list | `GET /kit/v1/sports` |

**Host:** `pinnacle-betting-odds.p.rapidapi.com`
**Auth:** `x-rapidapi-key: <key>`
**sport_id = 2** (Tennis). Note: p_id=33 is Pinnacle's internal ID — the API uses its own id=2.

---

## Rate Limits

| Limit | Value | Safe setting |
|---|---|---|
| Requests/hour | 1,000 | 1 req per 3,700ms (~972/hr) |
| Requests/key | 550 | Hard stop at 540 (leave buffer) |

Script is **resumable**: cached detail files are skipped on re-run with a new key.

---

## Archive Response Shape

```json
{
  "events": [
    {
      "event_id": 1627180082,
      "league_name": "ATP Houston - R16",
      "resulting_unit": "Games",        // ← USE THIS, not "Sets"
      "home": "Ben Shelton (Games)",
      "away": "Zhizhen Zhang (Games)",
      "starts": "2026-04-01T23:17:59",
      "is_have_periods": true,
      "parent_id": 1627159415,          // points to the "Sets" parent event
      "period_results": [
        { "number": 0, "team_1_score": 14, "team_2_score": 12 },  // full match games
        { "number": 1, "team_1_score": 7,  "team_2_score": 6  }   // first-set games ← USE THIS
      ]
    }
  ]
}
```

**Critical:** Only `resulting_unit === "Games"` events have game-level scores.
`resulting_unit === "Sets"` events have set-level results (1-0, 2-1) — useless for game totals.

---

## Details Response Shape

```json
{
  "events": [
    {
      "event_id": 1627180082,
      "periods": {
        "num_0": { ... },      // full match
        "num_1": {             // first set ← USE THIS
          "number": 1,
          "description": "1st Set",
          "totals": null,      // ALWAYS null after settlement — ignore
          "history": {
            "totals": {        // ← CLOSING PRICES ARE HERE
              "8.5":  { "over": [[ts, price, max], ...], "under": [[ts, price, max], ...] },
              "9.5":  { "over": [[ts, price, max], ...], "under": [[ts, price, max], ...] },
              "10.5": { "over": [[ts, price, max], ...], "under": [[ts, price, max], ...] }
            },
            "moneyline": { ... }   // first-set winner — not used
          }
        }
      }
    }
  ]
}
```

**Closing price** = last entry `[1]` in each history array (index 0 = timestamp, 1 = price, 2 = max bet).
**Opening price** = first entry `[1]`.

---

## Archive Scale (Jul 14, 2025 – Apr 2, 2026)

| Metric | Value |
|---|---|
| Total events in archive | ~46,300 |
| Pages (100 events/page) | 463 pages (hits empty at 464) |
| Page_num hard cap | 1,000 |
| Events with `is_have_periods=true` | ~99% (flag is not a useful filter) |
| `resulting_unit === "Games"` | ~46% of all events = ~21,300 |
| Games events with first-set totals in details | ~90% |
| **Estimated valid records (full run)** | **~19,000** |

---

## Budget Estimates

| Goal | Archive calls | Details calls | Total | Keys needed |
|---|---|---|---|---|
| ~500 records | 13 pages | ~550 | ~560 | 1 key |
| ~1,000 records | 25 pages | ~1,100 | ~1,125 | 2 keys |
| ~2,000 records | 50 pages | ~2,200 | ~2,250 | 4–5 keys |
| Full dataset (~19k) | 463 pages | ~21,300 | ~21,760 | ~40 keys |

Archive is **cached** after first run — subsequent re-runs with new keys only spend budget on details.

---

## League Coverage

Pinnacle offers first-set totals for **all levels**:
- ATP main draw ✓
- WTA main draw ✓
- ATP Challengers ✓
- WTA 125K ✓
- **ITF ✓** (confirmed: ~90% hit rate same as ATP/WTA)
- Davis Cup team events — unknown, likely excluded by scoring logic

No league filter needed. Events without totals fall into `skips.noPeriod` naturally.

---

## Lines Available

All three lines are present on ~90% of "Games" events:

| Line | Over means | Under means |
|---|---|---|
| 8.5 | total ≥ 9 games (6-3, 6-4, 7-5, 7-6TB) | total ≤ 8 games (6-0, 6-1, 6-2) |
| 9.5 | total ≥ 10 games (6-4, 7-5, 7-6TB) | total ≤ 9 games (6-0, 6-1, 6-2, 6-3) |
| 10.5 | total ≥ 12 games (7-5, 7-6TB) | total ≤ 10 games (6-0, 6-1, 6-2, 6-3, 6-4) |

Note: 11 total games is **impossible** in tennis (no 5-6 score).
Note: 9.5 coverage slightly lower than 8.5/10.5 — Pinnacle sometimes skips it.

---

## 9.5 Line Math (Soft Book vs Pinnacle)

When Pinnacle doesn't offer 9.5, its 8.5 and 10.5 bracket the zone:

```
P(total=9) + P(total=10)  =  Fair(8.5 over) − Fair(10.5 over)
```

To compute fair probability from any decimal price pair:
```
raw_over  = 1 / over_price
raw_under = 1 / under_price
vig       = raw_over + raw_under − 1
fair_over = raw_over / (raw_over + raw_under)
```

If a soft bookmaker offers 9.5, their implied P(≥10) can be benchmarked as:
- If their P(≥10) > Pinnacle's (fair_8.5_over − empirical_P(total=9)) → soft book overprices Over 9.5
- Edge = actual hit rate − soft book implied probability

**No need to have Pinnacle 9.5 data to benchmark a soft book's 9.5 line.**

---

## Valid Set Totals

```
{ 6, 7, 8, 9, 10, 12, 13 }
```
- 6 = 6-0, 7 = 6-1, 8 = 6-2, 9 = 6-3, 10 = 6-4, 12 = 7-5, 13 = 7-6(TB)
- 11 is impossible (no 5-6 score in tennis)
- Totals outside this set = retirement/walkover → excluded from dataset

---

## Test Run Results (37 records, 2026-04-01 only)

Distribution:
```
6-0:   8.1%
6-1:  10.8%
6-2:  18.9%
6-3:  21.6%
6-4:  13.5%
7-5:   5.4%
7-6TB: 21.6%
Mean total: 9.51
```

Early signals (N too small for conclusions):
- WTA 10.5 Under: +16% edge, z=−1.91 at N=23
- ATP 10.5 Over: +24% edge, z=1.75 at N=13
- These cancel in the baseline — ATP/WTA split is important

---

## Scripts

| Script | Command | Purpose |
|---|---|---|
| 00-inspect-api.ts | `npx tsx 00-inspect-api.ts` | API structure probe + event count |
| 01-extract.ts | `MAX_PAGES=50 MAX_DETAILS=2200 PINNACLE_RAPID_KEY=xxx npx tsx 01-extract.ts` | Extract + cache + merge dataset |
| 02-analyze.ts | `npx tsx 02-analyze.ts` | Run analysis on dataset.json |

**01-extract.ts** is resumable: re-run with new key after session cap — already-cached details are skipped.
