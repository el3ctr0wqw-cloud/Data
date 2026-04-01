# Data Map — Tennis Analytics Project

Quick-reference guide for all data files, schemas, scripts, and their relationships.

---

## 1. File Inventory

| Path | Size | Type | Description |
|------|------|------|-------------|
| `archive_atp/atp_tennis.csv` | 8.6 MB | CSV | ATP match records with odds, 2000–2026 (67,288 rows) |
| `archive_wta/wta.csv` | 5.7 MB | CSV | WTA match records with odds, 2007–2026 (44,104 rows) |
| `tennis_atp/` | ~395 MB | Submodule | JeffSackmann ATP data — matches, rankings, players (1968–2024) |
| `tennis_wta/` | ~232 MB | Submodule | JeffSackmann WTA data — matches, rankings, players (1968–2024) |
| `match_charting/` | ~1.1 GB | Submodule | Shot-by-shot match charting (pre-2009–2025) |
| `tennis_odds_analysis.py` | 9.2 KB | Script | Odds coverage, favorite win rates, ROI analysis |
| `stability_analysis.py` | 4.9 KB | Script | Temporal drift in match game totals |
| `under_analysis.py` | 7.9 KB | Script | Segmented under/over rates across all dimensions |
| `UNDER_RESEARCH_PHASE1.md` | 6.3 KB | Research | Phase 1 synthesis — findings and Phase 2 priorities |
| `archive.zip` | 1.5 MB | Archive | Backup of atp_tennis.csv |
| `archive (1) wta.zip` | 1.1 MB | Archive | Backup of wta.csv |
| `README.md` | 6 B | Doc | Minimal placeholder |

To update submodules: `git submodule update --remote`

---

## 2. Odds/Results Dataset — `archive_atp/` and `archive_wta/`

The primary datasets used by the analysis scripts. **Unique feature: bookmaker odds.**

### `archive_atp/atp_tennis.csv`

**67,288 rows · 17 columns · 2000-01-03 to 2026-03-15**

| Column | Type | Description | Notes |
|--------|------|-------------|-------|
| Tournament | string | Tournament name | — |
| Date | date | Match date | YYYY-MM-DD |
| Series | string | Tournament tier | International, Masters 1000, ATP500, ATP250, Masters, International Gold |
| Court | string | Court condition | Outdoor (55,267) / Indoor (12,021) |
| Surface | string | Playing surface | Hard, Clay, Grass, Carpet |
| Round | string | Match stage | 1st Round through The Final, Round Robin |
| Best of | integer | Sets format | 3 (nearly all); 5 (rare) |
| Player_1 | string | Player name + initial | e.g. "Medvedev D." |
| Player_2 | string | Player name + initial | — |
| Winner | string | Match winner | — |
| Rank_1 | integer | ATP ranking of Player_1 | 0 or -1 = unranked/unavailable |
| Rank_2 | integer | ATP ranking of Player_2 | — |
| Pts_1 | integer | Ranking points for Player_1 | -1 = unavailable |
| Pts_2 | integer | Ranking points for Player_2 | — |
| Odd_1 | float | Decimal odds for Player_1 | -1.0 = unavailable |
| Odd_2 | float | Decimal odds for Player_2 | — |
| Score | string | Final match score | e.g. "6-3 7-6"; tiebreaks shown as [7] |

### `archive_wta/wta.csv`

**44,104 rows · 16 columns · 2007-01-01 to 2026-03-15**

Same schema as ATP with two differences:
- **No `Series` column** — scripts assign `Series = 'WTA'` synthetically
- **Date format:** `YYYY-MM-DD HH:MM:SS` — time is always `00:00:00`

### ATP vs WTA (archive datasets)

| Aspect | ATP | WTA |
|--------|-----|-----|
| Total rows | 67,288 | 44,104 |
| Date range | 2000–2026 | 2007–2026 |
| Mean games/match (BO3) | 23.3 | 21.7 |
| Odds coverage | Sparse pre-2004 | Good from 2007 |
| Surfaces | Hard, Clay, Grass, Carpet | Hard, Clay, Grass |

---

## 3. JeffSackmann ATP Data — `tennis_atp/`

**Source:** [JeffSackmann/tennis_atp](https://github.com/JeffSackmann/tennis_atp)  
**Total size:** ~395 MB · 168 CSV files · Coverage: 1968–2024  
**Key advantage over archive_atp:** Richer match stats (aces, DFs, serve %, break points), player IDs, match duration, full tournament metadata. No bookmaker odds.

### 3.1 Main Tour Matches

**57 files:** `atp_matches_1968.csv` through `atp_matches_2024.csv`  
**~25–30 MB total** · Match stats available from 1991 onward

**Schema (51 columns):**

| Group | Columns |
|-------|---------|
| Tournament | `tourney_id`, `tourney_name`, `surface`, `draw_size`, `tourney_level`, `tourney_date`, `match_num` |
| Winner | `winner_id`, `winner_seed`, `winner_entry`, `winner_name`, `winner_hand`, `winner_ht`, `winner_ioc`, `winner_age` |
| Loser | `loser_id`, `loser_seed`, `loser_entry`, `loser_name`, `loser_hand`, `loser_ht`, `loser_ioc`, `loser_age` |
| Result | `score`, `best_of`, `round`, `minutes` |
| Winner stats | `w_ace`, `w_df`, `w_svpt`, `w_1stIn`, `w_1stWon`, `w_2ndWon`, `w_SvGms`, `w_bpSaved`, `w_bpFaced` |
| Loser stats | `l_ace`, `l_df`, `l_svpt`, `l_1stIn`, `l_1stWon`, `l_2ndWon`, `l_SvGms`, `l_bpSaved`, `l_bpFaced` |
| Rankings | `winner_rank`, `winner_rank_points`, `loser_rank`, `loser_rank_points` |

`tourney_level` values: `G` (Grand Slam), `M` (Masters), `A` (ATP 500/250), `D` (Davis Cup), `F` (Tour Finals)

### 3.2 Other Match File Categories

| Category | Files | Size | Coverage | Notes |
|----------|-------|------|----------|-------|
| Doubles | `atp_matches_doubles_2000–2020.csv` | ~5–6 MB | 2000–2020 | Updates suspended 2020; 60-col schema (team-based) |
| Futures | `atp_matches_futures_1991–2024.csv` | ~60+ MB | 1991–2024 | Same 51-col schema; stats from 2011 |
| Qual/Challenger | `atp_matches_qual_chall_1978–2024.csv` | ~50+ MB | 1978–2024 | Same schema; chall stats 2008+, qual stats 2011+ |
| Amateur | `atp_matches_amateur.csv` | 3.9 MB | Historical | Pre-Open Era amateur matches |

### 3.3 Rankings

**7 files:** `atp_rankings_70s.csv` through `atp_rankings_20s.csv` + `atp_rankings_current.csv`  
**~74.8 MB total** · Coverage: 1970s–present (1982 missing; 1973–1984 intermittent)

**Schema (4 columns):** `ranking_date, rank, player (player_id), points`

### 3.4 Players

**`atp_players.csv`** · 2.5 MB  
**Schema (8 columns):** `player_id, name_first, name_last, hand, dob, ioc, height, wikidata_id`

---

## 4. JeffSackmann WTA Data — `tennis_wta/`

**Source:** [JeffSackmann/tennis_wta](https://github.com/JeffSackmann/tennis_wta)  
**Total size:** ~232 MB · 121 CSV files · Coverage: 1968–2024  
**Key advantage over archive_wta:** Same richer match stats as ATP; full historical depth back to 1968. No bookmaker odds.

### 4.1 Main Tour Matches

**57 files:** `wta_matches_1968.csv` through `wta_matches_2024.csv`  
**~25–30 MB total**

**Schema:** Identical 51-column structure to ATP main tour matches (Section 3.1).  
`tourney_level` values: `G` (Grand Slam), `P` (Premier/WTA 1000), `PM` (Premier Mandatory), `I` (International), `IT` (ITF)

### 4.2 Qualifying & ITF Matches

**57 files:** `wta_matches_qual_itf_1968.csv` through `wta_matches_qual_itf_2024.csv`  
**~140–150 MB total** (bulk of the repo — recent years are large: 2024 file is ~7 MB)  
**Schema:** Same 51 columns as main tour.

### 4.3 Rankings

**6 files:** `wta_rankings_80s.csv` through `wta_rankings_20s.csv` + `wta_rankings_current.csv`  
**~50.5 MB total** · Coverage: 1980s–present

**Schema (5 columns):** `ranking_date, rank, player (player_id), points, tours`  
Note: WTA rankings include `tours` (tournaments played) — not present in ATP rankings.

### 4.4 Players

**`wta_players.csv`** · 2.36 MB  
**Schema (8 columns):** `player_id, name_first, name_last, hand, dob, ioc, height, wikidata_id`  
Identical structure to `atp_players.csv`.

---

## 5. Match Charting Project — `match_charting/`

**Source:** [JeffSackmann/tennis_MatchChartingProject](https://github.com/JeffSackmann/tennis_MatchChartingProject)  
**Total size:** ~1.1 GB  
**Coverage:** Pre-2009 through December 2025 · Men's + Women's tours  
**Granularity:** Shot-by-shot point charting — serve type, direction, rally sequence, shot type, outcome

### 5.1 Match Metadata

| File | Size | Rows | Description |
|------|------|------|-------------|
| `charting-m-matches.csv` | 1.1 MB | 7,194 | Men's charted matches |
| `charting-w-matches.csv` | 572 KB | 3,824 | Women's charted matches |

**Schema (15 columns):** `match_id, Player 1, Player 2, Pl 1 hand, Pl 2 hand, Date (YYYYMMDD), Tournament, Round, Time, Court, Surface, Umpire, Best of, Final TB?, Charted by`

### 5.2 Point-by-Point Data

| File | Size | Era |
|------|------|-----|
| `charting-m-points-to-2009.csv` | 36 MB | Men's, pre-2010 |
| `charting-m-points-2010s.csv` | 35.8 MB | Men's, 2010–2019 |
| `charting-m-points-2020s.csv` | 52.9 MB | Men's, 2020–present |
| `charting-w-points-to-2009.csv` | 5.6 MB | Women's, pre-2010 |
| `charting-w-points-2010s.csv` | 18 MB | Women's, 2010–2019 |
| `charting-w-points-2020s.csv` | 30.4 MB | Women's, 2020–present |

**Schema (14 columns):** `match_id, Pt, Set1, Set2, Gm1, Gm2, Pts, Gm#, TbSet, Svr, 1st, 2nd, Notes, PtWinner`

Serve fields (`1st`/`2nd`) encode direction, outcome, and full rally shot sequence in compact notation. See `match_charting/data_dictionary.txt` for the key.

### 5.3 Pre-aggregated Statistics Files (26 files)

13 men's + 13 women's files covering: Overview, Rally, Serve Basics, Serve Direction, Serve Influence, Key Points Serve, Key Points Return, Return Depth, Return Outcomes, Shot Direction, Shot Dir Outcomes, Shot Types, Net Points, Serve & Volley, Sv Break Total, Sv Break Split. All join on `match_id`.

---

## 6. Dataset Comparison

| Aspect | archive_atp/wta | tennis_atp/wta | match_charting |
|--------|----------------|----------------|----------------|
| Purpose | Odds + results | Rich match stats | Shot-by-shot |
| Date range | 2000/2007–2026 | 1968–2024 | pre-2009–2025 |
| Matches (M) | 67,288 | ~200k+ (all levels) | 7,194 charted |
| Matches (W) | 44,104 | ~120k+ (all levels) | 3,824 charted |
| Has bookmaker odds | Yes | No | No |
| Has serve stats | No | Yes (1991+/tour) | Yes (shot-level) |
| Has player IDs | No | Yes | No |
| Has match duration | No | Yes | No |
| Has rankings | Inline | Separate files | No |
| Tour levels | Main tour only | All levels | Main tour mostly |
| Join key to others | Date + name | `winner_id`/`loser_id` → players file | Date + name (fuzzy) |

---

## 7. Scripts

### `tennis_odds_analysis.py`
**Inputs:** `archive_atp/atp_tennis.csv`, `archive_wta/wta.csv`
- Favorite win rates and implied probability calibration
- ROI for flat-bet strategies on favorites and underdogs
- Bookmaker overround (vig/margin), upset rates by surface and round
- Heavy-favorite performance (odds < 1.20), year-over-year trends

### `stability_analysis.py`
**Inputs:** `archive_atp/atp_tennis.csv`, `archive_wta/wta.csv`
- Parses Score strings → total games; BO3-only filter
- Year-by-year under rates (U21.5, U22.5, U23.5); 3-year rolling means
- Segment stability tests: WTA 200+ gap, ATP International×Clay, ATP Hard×200+ gap

### `under_analysis.py`
**Inputs:** `archive_atp/atp_tennis.csv`, `archive_wta/wta.csv`
- Under rates by surface, round, ATP Series tier, ranking gap buckets (0–10, 11–25, 26–50, 51–100, 101–200, 200+)
- Combined filters: Surface × Ranking Gap, Series × Surface
- Mean total games per segment; sample size (n) per segment

---

## 8. Summary Statistics

| Metric | archive ATP | archive WTA | JS ATP (main) | JS WTA (main) | Charting M | Charting W |
|--------|------------|------------|--------------|--------------|-----------|-----------|
| Total matches | 67,288 | 44,104 | ~200k+ | ~120k+ | 7,194 | 3,824 |
| Date range | 2000–2026 | 2007–2026 | 1968–2024 | 1968–2024 | pre-2009–2025 | pre-2009–2025 |
| Has odds | Yes | Yes | No | No | No | No |
| U22.5 rate (all) | 55.4% | 62.7% | — | — | — | — |
| U22.5 rate (2019+) | 52.8% | 61.2% | — | — | — | — |

---

## 9. Data Quality Notes

**archive_atp / archive_wta:**
1. **Odds missing:** `-1.0` in `Odd_1`/`Odd_2` — widespread in ATP pre-2004.
2. **Rankings:** `Rank_*` = 0 or -1 = unranked/unavailable; `Pts_*` = -1 = unavailable.
3. **Retirements/walkovers:** Score strings without parseable sets are silently dropped by score-parsing scripts.
4. **WTA Date timestamp:** `HH:MM:SS` always `00:00:00`. Use `pd.to_datetime().dt.date` to normalize.
5. **WTA Series:** No tier field — scripts inject `Series = 'WTA'` at runtime.
6. **Score tiebreak notation:** `[7]` appended to set score; stripped by regex parser.
7. **Carpet surface:** ATP 1,632 rows, WTA 161 rows; phased out post-2009.
8. **WTA Best-of-5:** 1 row — data error; all analyses filter `Best of == 3`.
9. **WTA Score trailing whitespace:** Use `.str.strip()` before string comparisons.
10. **ATP pre-2004 sparsity:** Ranking points and odds largely missing 2000–2003.

**tennis_atp / tennis_wta:**
11. **ATP rankings gap:** 1982 data missing; 1973–1984 intermittent.
12. **Match stats availability:** ATP tour 1991+, challengers 2008+, qualifying 2011+.
13. **ATP doubles suspended:** No updates after late 2020.
14. **WTA rankings extra column:** `tours` (tournaments played) — not in ATP rankings.
15. **Player join:** Match files use `winner_id`/`loser_id` as integer IDs; join to `atp_players.csv` / `wta_players.csv` on `player_id`.

**match_charting:**
16. **No direct FK to ATP/WTA CSVs:** Join on `Date` (normalize YYYYMMDD ↔ YYYY-MM-DD) + fuzzy player surname matching.
17. **Coverage bias:** Volunteer-contributed; skews toward high-profile matches (Grand Slams, Masters). Not a representative sample.

---

## 10. Research Reference — `UNDER_RESEARCH_PHASE1.md`

Derived entirely from `archive_atp/atp_tennis.csv` and `archive_wta/wta.csv` via `stability_analysis.py` and `under_analysis.py`. No external data at this phase.

**Key findings (full tables in `UNDER_RESEARCH_PHASE1.md`):**
- ATP and WTA are structurally different markets
- ATP mean 23.3 games vs WTA 21.7 — WTA plays ~1.6 fewer games per match
- **ATP drift:** +0.72 games/match since 2013; recent U22.5 ~52.8% — near break-even
- **WTA drift:** Plateaued ~2019; recent U22.5 ~61.2% — stable primary target
- **Strongest signal:** WTA ranking gap 200+ → 70.1% U22.5 (n=2,521; range 61–78%)
- Surface filter: meaningful for ATP (Clay best), flat for WTA
- Round filter: R1/R2 best; Finals worst (~4pp penalty)

**Phase 2 requirement:** Historical O/U closing lines (Pinnacle preferred) for WTA matches 2019+.
