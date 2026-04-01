# Data Map — Tennis Analytics Project

Quick-reference guide for all data files, schemas, scripts, and their relationships.

---

## 1. File Inventory

| Path | Size | Type | Description |
|------|------|------|-------------|
| `archive_atp/atp_tennis.csv` | 8.6 MB | CSV | ATP match records, 2000–2026 (67,288 rows) |
| `archive_wta/wta.csv` | 5.7 MB | CSV | WTA match records, 2007–2026 (44,104 rows) |
| `tennis_odds_analysis.py` | 9.2 KB | Script | Odds coverage, favorite win rates, ROI analysis |
| `stability_analysis.py` | 4.9 KB | Script | Temporal drift in match game totals |
| `under_analysis.py` | 7.9 KB | Script | Segmented under/over rates across all dimensions |
| `UNDER_RESEARCH_PHASE1.md` | 6.3 KB | Research | Phase 1 synthesis — findings and Phase 2 priorities |
| `archive.zip` | 1.5 MB | Archive | Backup of atp_tennis.csv |
| `archive (1) wta.zip` | 1.1 MB | Archive | Backup of wta.csv |
| `README.md` | 6 B | Doc | Minimal placeholder |

---

## 2. ATP Dataset — `archive_atp/atp_tennis.csv`

**67,288 rows · 17 columns · 2000-01-03 to 2026-03-15**

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| Tournament | string | Tournament name | e.g. "Australian Hardcourt Championships" |
| Date | date | Match date | YYYY-MM-DD |
| Series | string | Tournament tier | International, Masters 1000, ATP500, ATP250, Masters, International Gold |
| Court | string | Court condition | Outdoor (55,267) / Indoor (12,021) |
| Surface | string | Playing surface | Hard, Clay, Grass, Carpet |
| Round | string | Match stage | 1st Round, 2nd Round, 3rd Round, 4th Round, Quarterfinals, Semifinals, The Final, Round Robin |
| Best of | integer | Sets format | 3 (nearly all); 5 (rare) |
| Player_1 | string | Player name + initial | e.g. "Medvedev D." |
| Player_2 | string | Player name + initial | — |
| Winner | string | Match winner | Matches Player_1 or Player_2 |
| Rank_1 | integer | ATP ranking of Player_1 | 0 or -1 = unranked/unavailable |
| Rank_2 | integer | ATP ranking of Player_2 | — |
| Pts_1 | integer | ATP ranking points for Player_1 | -1 = unavailable |
| Pts_2 | integer | ATP ranking points for Player_2 | — |
| Odd_1 | float | Decimal odds for Player_1 | -1.0 = unavailable |
| Odd_2 | float | Decimal odds for Player_2 | — |
| Score | string | Final match score | e.g. "6-3 7-6"; tiebreaks shown as [7] |

---

## 3. WTA Dataset — `archive_wta/wta.csv`

**44,104 rows · 16 columns · 2007-01-01 to 2026-03-15**

Same schema as ATP with two differences:

- **No `Series` column** — WTA has no tier field in the raw data; scripts assign `Series = 'WTA'` synthetically
- **Date format:** `YYYY-MM-DD HH:MM:SS` — time component is always `00:00:00`

All other columns (Tournament, Court, Surface, Round, Best of, Player_1, Player_2, Winner, Rank_1, Rank_2, Pts_1, Pts_2, Odd_1, Odd_2, Score) are identical in name and meaning to ATP.

---

## 4. ATP vs WTA Comparison

| Aspect | ATP | WTA |
|--------|-----|-----|
| Total rows | 67,288 | 44,104 |
| Date range | 2000–2026 | 2007–2026 |
| Column count | 17 | 16 |
| Unique column | `Series` (tier) | — |
| Date format | `YYYY-MM-DD` | `YYYY-MM-DD HH:MM:SS` |
| Surfaces | Hard, Clay, Grass, Carpet | Hard, Clay, Grass |
| Best-of-3 matches | 54,581 | 44,100 |
| Mean games/match (BO3) | 23.3 | 21.7 |
| Odds coverage | Sparse pre-2004 | Good from 2007 onward |
| Rankings available from | ~2000 (sparse early) | 2007 |

---

## 5. Summary Statistics

| Metric | ATP | WTA | Combined |
|--------|-----|-----|----------|
| Total matches | 67,288 | 44,104 | 111,392 |
| Best-of-3 matches | 54,581 | 44,100 | 98,681 |
| Shared date overlap | — | — | 2007–2026 |
| U22.5 base rate (all years) | 55.4% | 62.7% | — |
| U22.5 base rate (2019+) | 52.8% | 61.2% | — |

Missing value sentinel: `-1` for integers, `-1.0` for floats.

---

## 6. Scripts

### `tennis_odds_analysis.py`
**Inputs:** `atp_tennis.csv`, `wta.csv`

- Validates odds data coverage (filters rows where `Odd_1 == -1.0`)
- Calculates favorite win rates and implied probability calibration
- Computes ROI for flat-bet strategies on favorites and underdogs
- Measures bookmaker overround (vig/margin)
- Stratifies upset rates by surface and round
- Tests heavy-favorite performance (odds < 1.20)
- Tracks year-over-year favorite win rate trends

### `stability_analysis.py`
**Inputs:** `atp_tennis.csv`, `wta.csv`

- Parses Score strings → total games played per match
- Filters to best-of-3 matches only
- Produces year-by-year under rates for lines U21.5, U22.5, U23.5
- Computes 3-year rolling means to detect structural drift
- Tests segment stability: WTA 200+ ranking gap, WTA 51–100 gap, ATP International×Clay, ATP Hard×200+ gap

### `under_analysis.py`
**Inputs:** `atp_tennis.csv`, `wta.csv`

- Merges both tours into a single DataFrame with a `Tour` label (`ATP` / `WTA`)
- WTA rows receive a synthetic `Series = 'WTA'` for compatibility
- Calculates under rates for U21.5, U22.5, U23.5 broken down by:
  - Surface (Clay, Hard, Grass, Carpet)
  - Round (1st Round through The Final)
  - ATP Series tier
  - Ranking gap buckets: 0–10, 11–25, 26–50, 51–100, 101–200, 200+
  - Combined filters: Surface × Ranking Gap, Series × Surface
- Reports mean total games per segment for line calibration
- Includes sample size (n) for each segment

---

## 7. Data Quality Notes

1. **Odds missing:** `-1.0` in `Odd_1`/`Odd_2` — widespread in ATP pre-2004; filter with `Odd_1 != -1.0` before any odds analysis.
2. **Rankings unranked:** `Rank_1`/`Rank_2` = 0 or -1 means unranked or unavailable; exclude from ranking-gap calculations.
3. **Ranking points unavailable:** `Pts_1`/`Pts_2` = -1 — common pre-2008 for ATP; near-universal for WTA pre-2010.
4. **Retirements/walkovers:** Rows where Score contains no parseable set scores (e.g., "W/O", "RET") are silently dropped by the score-parsing regex in `stability_analysis.py` and `under_analysis.py`.
5. **WTA Date timestamp:** Format includes `HH:MM:SS` always set to `00:00:00`. Parse with `pd.to_datetime()` and `.dt.date` to normalize.
6. **ATP `Series` has no WTA equivalent:** Scripts assign `Series = 'WTA'` to all WTA rows to enable combined DataFrames; this is a code convention, not raw data.
7. **Tiebreak notation in Score:** Set scores like `7-6` may be followed by `[7]` indicating tiebreak score. The score parser uses regex to extract set totals only.
8. **Carpet surface:** ATP 1,632 rows; WTA 161 rows. Carpet was phased out post-2009 — no recent data. Treat as a historical artifact; some analyses exclude it.
9. **WTA Best-of-5:** 1 row in the WTA dataset has `Best of = 5`. Almost certainly a data entry error. All analyses filter `Best of == 3`.
10. **WTA Score trailing whitespace:** Several WTA Score values end with a trailing space (e.g., `"6-1 6-1 "`). Use `.str.strip()` before any string comparisons.
11. **ATP pre-2004 data sparsity:** Ranking points and odds are largely missing for 2000–2003. Any analysis using these fields should confirm coverage before drawing conclusions.

---

## 8. Research Reference — `UNDER_RESEARCH_PHASE1.md`

Phase 1 findings are derived entirely from `atp_tennis.csv` and `wta.csv` using `stability_analysis.py` and `under_analysis.py`. No external data sources are used at this phase.

**Key findings (summary — full tables in `UNDER_RESEARCH_PHASE1.md`):**

- ATP and WTA are structurally different markets; must be analyzed separately
- ATP mean 23.3 games vs WTA 21.7 games — WTA plays ~1.6 fewer games per match
- **ATP drift:** Permanent structural lengthening since 2013 (+0.72 games/match); recent U22.5 rate ~52.8% — near vig break-even (~54% needed); requires confirmed line mispricing
- **WTA drift:** Mild drift, plateaued ~2019; recent U22.5 ~61.2% — stable and primary research target
- **Strongest signal:** WTA ranking gap 200+ → 70.1% U22.5 (n=2,521; range 61–78% across all years)
- Surface filter: meaningful for ATP (Clay best, Grass worst); essentially flat for WTA (~2pp spread)
- Round filter: R1/R2 best for both tours; Finals worst (~4pp penalty)

**Phase 2 requirement:** Historical O/U closing lines (Pinnacle preferred) for WTA matches 2019+ to calculate actual ROI on real odds vs. base rates.
