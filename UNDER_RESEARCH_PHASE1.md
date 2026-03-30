# Tennis Total Games Under — Phase 1 Research Conclusions

**Date:** 2026-03-30
**Data sources:** ATP (54,581 BO3 matches, 2000–2026) · WTA (44,100 BO3 matches, 2007–2026)
**Scope:** Base rates from actual match scores only. No O/U odds data yet.
**Focus lines:** U21.5 · U22.5 · U23.5

---

## Core Finding: Two Different Markets

WTA and ATP behave structurally differently and must be treated as separate propositions.

| | Mean games | U21.5 | U22.5 | U23.5 |
|---|---|---|---|---|
| ATP (all years) | 23.3 | 47.7% | 55.4% | 61.0% |
| WTA (all years) | 21.7 | 57.3% | 62.7% | 66.4% |
| ATP recent (2019+) | 23.6 | 44.5% | 52.8% | 58.9% |
| WTA recent (2019+) | 22.0 | 55.4% | 61.2% | 64.9% |

WTA plays ~1.6 fewer games per match. At U22.5, WTA sits 8–10 percentage points higher than ATP.

---

## ATP: Drift Problem

ATP has undergone a permanent structural shift since 2013 — matches are longer.

| Era | Mean games | U22.5 |
|---|---|---|
| 2000–2013 | 22.85 | 57.1% |
| 2014–2018 | 23.45 | 53.6% |
| 2019–2026 | 23.57 | 52.8% |

**+0.72 games per match added since 2013.** At U22.5, ATP base rates are at or near the break-even zone once vig is applied (~54% needed). ATP cannot be flat-bet on base rates alone — any ATP position requires verified line mispricing.

---

## WTA: Mild Drift, Now Plateaued

WTA also drifted longer but stabilised around 2019.

| Era | Mean games | U22.5 |
|---|---|---|
| 2007–2013 | 21.4 | 64.5% |
| 2014–2018 | 21.8 | 62.2% |
| 2019–2026 | 22.0 | 61.2% |

3-year rolling mean has been flat at ~21.95 since 2019. WTA under rates are stable in the current era. **WTA is the primary hunting ground.**

---

## Surface Effects

### ATP — counter-intuitive direction
| Surface | Mean games | U22.5 |
|---|---|---|
| Clay | 22.74 | 57.3% |
| Hard | 23.29 | 54.9% |
| Carpet | 23.61 | 52.8% |
| Grass | 23.88 | 51.7% |

Grass produces the most games and fewest unders in ATP. Clay is the ATP under surface. This is counter-intuitive and matters for filter design.

### WTA — surface effects are flat (~2pp spread)
| Surface | Mean games | U22.5 |
|---|---|---|
| Clay | 21.58 | 63.0% |
| Hard | 21.68 | 62.9% |
| Grass | 22.21 | 60.8% |

WTA surface is not a meaningful filter. Ranking gap dominates instead.

---

## Ranking Gap — Strongest Signal

Monotonically increasing under rates as gap widens. Recent era (2019+):

| Ranking gap | WTA U22.5 | WTA mean | ATP U22.5 | ATP mean |
|---|---|---|---|---|
| 0–10 (even) | 57.4% | 22.5 | 51.5% | 23.9 |
| 11–25 | 58.7% | 22.4 | 52.4% | 23.7 |
| 26–50 | 59.2% | 22.2 | 52.4% | 23.6 |
| 51–100 | 62.9% | 21.7 | 53.7% | 23.4 |
| 101–200 | 63.2% | 21.6 | 53.4% | 23.4 |
| 200+ | **69.3%** | **20.8** | **58.6%** | **22.8** |

WTA 200+ gap is the single strongest signal: ~70% under rate at U22.5, stable across all years (61–78% range, never below 61%). This is the anchor segment for protocol design.

---

## Round Effects

Later rounds have more competitive matches → longer matches → fewer unders. Effect is consistent but modest (~4pp).

| Round | ATP U22.5 | WTA U22.5 |
|---|---|---|
| 1st Round | 56.0% | 63.2% |
| 2nd Round | 55.4% | 63.5% |
| 3rd–4th Round | 55.5% / 53.5% | 61.4% / 60.2% |
| Quarterfinals | 54.5% | 61.5% |
| Semifinals | 53.4% | 60.7% |
| The Final | 52.1% | 60.0% |

**R1 and R2 are the best rounds for unders on both tours.** Avoid finals and semis where possible.

---

## ATP Tier Effects

Lower-tier ATP events produce more unders than flagship events (~3.5pp spread).

| Tier | U22.5 |
|---|---|
| International / International Gold (pre-2009 label) | 57.4–57.5% |
| Masters (pre-2009 label) | 56.9% |
| ATP500 | 54.6% |
| Masters 1000 | 54.5% |
| ATP250 | 54.0% |

Aligns with derivative pricing hypothesis: lower-volume events receive less sharp attention, more formula-generated lines. Most likely mispricing ground for ATP if it exists.

---

## Top Segments by U22.5 Under Rate

| Segment | U22.5 | Stability | Total n |
|---|---|---|---|
| WTA 200+ ranking gap | **70.1%** | Excellent — all years 61–78% | 2,521 |
| WTA 101–200 ranking gap | 66.2% | Good | 5,166 |
| WTA 51–100 ranking gap | 65.4% | Good (mild softening 2013–2016) | 10,590 |
| ATP Hard × 200+ gap | 62.2% | Moderate (dipped 53–57% in 2017–2020) | 1,903 |
| ATP International × Clay | 60.5% | Strong pre-2009, unknown post-restructure | 4,372 |
| WTA overall | 62.7% | Stable since 2019 | 44,100 |

---

## What This Data Cannot Answer

These are base rates from actual game totals — not ROI on real O/U lines.

- Books don't set a fixed 22.5 line. A WTA 200+ gap match likely gets a line of 18.5–19.5, not 22.5.
- **The base rates show where to look for mispricing. They do not confirm mispricing exists.**
- ROI calculation requires actual historical O/U closing lines paired to these matches.

---

## Phase 2 Priorities

### Data to collect
- Historical O/U closing lines (Pinnacle preferred as sharpest) for WTA matches 2019+
- Match metadata to join: date, player names, tournament, surface, round
- Sources to evaluate: OddsPortal (OddsHarvester scraper), OddsBase.net (paid), The Odds API

### Analysis sequence once odds data is available
1. **Blind under ROI** — flat-bet every WTA under at closing Pinnacle odds. Establish bleed rate.
2. **Segment by ranking gap** — does WTA 51-100+ gap clear breakeven?
3. **Closing line movement** — do unders that move in (open → close) perform differently than stale lines?
4. **Favorite-longshot bias on totals** — extreme unders (e.g. U18.5 @ 3.50) vs tight unders (U22.5 @ 1.85).
5. **ATP conditional entry** — only test ATP 200+ gap segment; skip ATP broad.

### Phase 3 Decision Gate
- If blind WTA under bleed is worse than **-5%** with no segment beating breakeven → stop.
- If WTA 51–100+ gap segments show flat or positive ROI → build protocol targeting those segments.
- ATP enters protocol only if ATP 200+ gap clears breakeven independently.

---

## Protocol Design Anchors (pending odds validation)

**Primary target:** WTA, R1–R2, ranking gap ≥ 50
**Strongest filter:** Ranking gap ≥ 100 (WTA 200+ gap is the core)
**Surface filter:** Avoid grass (minor effect on WTA, meaningful on ATP)
**Round filter:** Prefer R1–R2; deprioritise semis and finals
**ATP stance:** Conditional only — requires line mispricing evidence, not base rates alone
