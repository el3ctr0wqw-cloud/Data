# Data Map — Tennis Analytics Project

Quick-reference guide for all data files, schemas, scripts, and their relationships.

---

## 1. File Inventory

| Path | Size | Type | Description |
|------|------|------|-------------|
| `archive_atp/atp_tennis.csv` | 8.6 MB | CSV | ATP match records, 2000–2026 (67,288 rows) |
| `archive_wta/wta.csv` | 5.7 MB | CSV | WTA match records, 2007–2026 (44,104 rows) |
| `match_charting/` | ~1.1 GB | Submodule | Shot-by-shot match charting — see Section 5 |
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

## 5. Match Charting Project — `match_charting/`

**Source:** [JeffSackmann/tennis_MatchChartingProject](https://github.com/JeffSackmann/tennis_MatchChartingProject)  
**Added as:** git submodule  
**Total size:** ~1.1 GB  
**Coverage:** Pre-2009 through December 2025 · Men's + Women's tours  
**Granularity:** Shot-by-shot point charting — serve type, direction, rally sequence, shot type, outcome

To update: `git submodule update --remote match_charting`

---

### 5.1 Match Metadata

| File | Size | Rows | Description |
|------|------|------|-------------|
| `charting-m-matches.csv` | 1.1 MB | 7,194 | Men's charted matches |
| `charting-w-matches.csv` | 572 KB | 3,824 | Women's charted matches |

**Schema (15 columns):**

| Column | Type | Description |
|--------|------|-------------|
| match_id | string | Unique match identifier — joins to all other charting files |
| Player 1 | string | Player 1 name |
| Player 2 | string | Player 2 name |
| Pl 1 hand | string | Player 1 handedness (R/L) |
| Pl 2 hand | string | Player 2 handedness (R/L) |
| Date | date | Match date (YYYYMMDD) |
| Tournament | string | Tournament name |
| Round | string | Match round |
| Time | string | Match duration |
| Court | string | Court name/number |
| Surface | string | Playing surface (Hard, Clay, Grass) |
| Umpire | string | Chair umpire name |
| Best of | integer | Match format (3 or 5) |
| Final TB? | string | Whether final set was a tiebreak |
| Charted by | string | Volunteer charter name |

---

### 5.2 Point-by-Point Data

Split into era-based files to keep sizes manageable. All share the same schema.

| File | Size | Era |
|------|------|-----|
| `charting-m-points-to-2009.csv` | 36 MB | Men's, pre-2010 |
| `charting-m-points-2010s.csv` | 35.8 MB | Men's, 2010–2019 |
| `charting-m-points-2020s.csv` | 52.9 MB | Men's, 2020–present |
| `charting-w-points-to-2009.csv` | 5.6 MB | Women's, pre-2010 |
| `charting-w-points-2010s.csv` | 18 MB | Women's, 2010–2019 |
| `charting-w-points-2020s.csv` | 30.4 MB | Women's, 2020–present |

**Schema (14 columns):**

| Column | Type | Description |
|--------|------|-------------|
| match_id | string | Join key to matches file |
| Pt | integer | Point number within match |
| Set1 / Set2 | integer | Games won in set by each player |
| Gm1 / Gm2 | integer | Points in current game by each player |
| Pts | string | Score notation (e.g. "0-15") |
| Gm# | integer | Game number within match |
| TbSet | integer | Tiebreak set flag |
| Svr | integer | Server (1 = Player 1, 2 = Player 2) |
| 1st | string | First serve coding — direction, outcome, rally sequence |
| 2nd | string | Second serve coding (same format; empty if first serve in) |
| Notes | string | Manual annotations by charter |
| PtWinner | integer | Point winner (1 or 2) |

**Serve/rally coding format:** Each serve field encodes serve direction, outcome, and the full rally shot sequence using a compact notation (e.g. `6*` = T-serve ace, `4` = body serve, followed by rally codes per shot). See `match_charting/data_dictionary.txt` for the full key.

---

### 5.3 Pre-aggregated Statistics Files

26 files (13 men's, 13 women's) — match-level aggregates derived from the point data. All join on `match_id`.

| Category | Men's file | Women's file | Size (M/W) | Description |
|----------|-----------|-------------|-----------|-------------|
| Overview | `charting-m-stats-Overview.csv` | `charting-w-stats-Overview.csv` | 6.3 MB / 2.9 MB | Serve pts, aces, DFs, 1st/2nd serve in/won, return pts, winners, unforced errors |
| Rally | `charting-m-stats-Rally.csv` | `charting-w-stats-Rally.csv` | 10.4 MB / 5.6 MB | Points won, winners, forced/unforced errors by rally length |
| Serve Basics | `charting-m-stats-ServeBasics.csv` | `charting-w-stats-ServeBasics.csv` | 4.3 MB / 2.2 MB | Serve placement counts: wide, body, T |
| Serve Direction | `charting-m-stats-ServeDirection.csv` | `charting-w-stats-ServeDirection.csv` | 4.4 MB / 2.3 MB | Serve direction to deuce and ad courts |
| Serve Influence | `charting-m-stats-ServeInfluence.csv` | `charting-w-stats-ServeInfluence.csv` | 3.9 MB / 2.1 MB | Serve placement impact on rally outcome |
| Key Points Serve | `charting-m-stats-KeyPointsServe.csv` | `charting-w-stats-KeyPointsServe.csv` | 5.5 MB / 2.9 MB | Serve performance on break points, game points, deuce |
| Key Points Return | `charting-m-stats-KeyPointsReturn.csv` | `charting-w-stats-KeyPointsReturn.csv` | 5.1 MB / 2.7 MB | Return performance on key points |
| Return Depth | `charting-m-stats-ReturnDepth.csv` | `charting-w-stats-ReturnDepth.csv` | 24.4 MB / 12.9 MB | Return landing zone depth analysis |
| Return Outcomes | `charting-m-stats-ReturnOutcomes.csv` | `charting-w-stats-ReturnOutcomes.csv` | 28.4 MB / 15.2 MB | Return success rates and outcomes |
| Shot Direction | `charting-m-stats-ShotDirection.csv` | `charting-w-stats-ShotDirection.csv` | 5.0 MB / 2.6 MB | Shot direction patterns (FH/BH, court zones) |
| Shot Dir Outcomes | `charting-m-stats-ShotDirOutcomes.csv` | `charting-w-stats-ShotDirOutcomes.csv` | 15.4 MB / 7.7 MB | Shot direction × outcome metrics |
| Shot Types | `charting-m-stats-ShotTypes.csv` | `charting-w-stats-ShotTypes.csv` | 31.7 MB / 15.7 MB | Shot type distribution and effectiveness |
| Net Points | `charting-m-stats-NetPoints.csv` | `charting-w-stats-NetPoints.csv` | 5.9 MB / 3.0 MB | Net approaches, winners, pass attempts, induced errors |
| Serve & Volley | `charting-m-stats-SnV.csv` | `charting-w-stats-SnV.csv` | 5.0 MB / 579 KB | Serve-and-volley frequency and success rate |
| Sv Break Total | `charting-m-stats-SvBreakTotal.csv` | `charting-w-stats-SvBreakTotal.csv` | 14.6 MB / 7.7 MB | Service break statistics (aggregated) |
| Sv Break Split | `charting-m-stats-SvBreakSplit.csv` | `charting-w-stats-SvBreakSplit.csv` | 15.8 MB / 8.3 MB | Service break statistics by match situation |

**Overview stats schema (key columns):** `match_id, player, set, serve_pts, aces, dfs, first_in, first_won, second_in, second_won, bk_pts, bp_saved, return_pts, return_pts_won, winners, winners_fh, winners_bh, unforced, unforced_fh, unforced_bh`

---

### 5.4 Joining Charting Data to ATP/WTA Match Records

The charting `match_id` format is `YYYYMMDD-T-Lastname_First-Lastname_First` (e.g. `20230129-M-Djokovic_Novak-Tsitsipas_Stefanos`). There is no direct foreign key to `atp_tennis.csv` / `wta.csv` — join on `Date` + normalized player surnames. A fuzzy match is required to handle name format differences.

---

## 6. Summary Statistics

| Metric | ATP | WTA | Charting (M) | Charting (W) |
|--------|-----|-----|-------------|-------------|
| Total matches | 67,288 | 44,104 | 7,194 | 3,824 |
| Best-of-3 matches | 54,581 | 44,100 | ~6,500 | ~3,800 |
| Date range | 2000–2026 | 2007–2026 | pre-2009–2025 | pre-2009–2025 |
| Granularity | Match result | Match result | Shot-by-shot | Shot-by-shot |
| U22.5 base rate (all years) | 55.4% | 62.7% | — | — |
| U22.5 base rate (2019+) | 52.8% | 61.2% | — | — |

Missing value sentinel in ATP/WTA CSVs: `-1` for integers, `-1.0` for floats.

---

## 7. Scripts

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

## 8. Data Quality Notes

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
12. **Charting data join:** No direct foreign key between `match_charting/` and the ATP/WTA CSVs. Joining requires date normalization (charting uses YYYYMMDD; ATP uses YYYY-MM-DD) and fuzzy player name matching.
13. **Charting coverage bias:** Charting data is volunteer-contributed and skews toward high-profile matches (Grand Slams, Masters). Not a representative sample of all ATP/WTA matches.

---

## 9. Research Reference — `UNDER_RESEARCH_PHASE1.md`

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
