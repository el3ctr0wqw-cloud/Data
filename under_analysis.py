import pandas as pd
import numpy as np
import re
import warnings
warnings.filterwarnings('ignore')

# ── Load data ──────────────────────────────────────────────────────────────
atp = pd.read_csv('/home/user/Data/archive_atp/atp_tennis.csv')
wta = pd.read_csv('/home/user/Data/archive_wta/wta.csv')

atp['tour'] = 'ATP'
wta['tour'] = 'WTA'
# WTA has no Series column
wta['Series'] = 'WTA'

df = pd.concat([atp, wta], ignore_index=True)

# ── Parse score → total games ──────────────────────────────────────────────
def parse_total_games(score):
    if not isinstance(score, str):
        return None
    score = score.strip()
    # Remove anything in brackets (tiebreak scores like [7])
    score = re.sub(r'\[\d+\]', '', score)
    # Find all set scores like 6-4, 7-5, 6-3, 10-8, etc.
    sets = re.findall(r'(\d+)-(\d+)', score)
    if not sets:
        return None
    total = sum(int(a) + int(b) for a, b in sets)
    return total if total >= 12 else None  # sanity: min realistic is 12 (6-0 6-0)

df['total_games'] = df['Score'].apply(parse_total_games)

# Drop retirements / walkovers / unparseable
valid = df[df['total_games'].notna()].copy()
print(f"Total valid matches: {len(valid):,}  (dropped {len(df)-len(valid):,} walkovers/retirements)")

# ── Best-of-3 only (the natural home for 21.5/22.5/23.5) ──────────────────
bo3 = valid[valid['Best of'] == 3].copy()
print(f"Best-of-3 matches: {len(bo3):,}")
print(f"  ATP: {len(bo3[bo3['tour']=='ATP']):,}   WTA: {len(bo3[bo3['tour']=='WTA']):,}")

# Distribution sanity check
print("\nTotal games distribution (BO3):")
print(bo3['total_games'].describe().round(2))
print(f"Mode: {bo3['total_games'].mode()[0]}")

# ── Under rate function ────────────────────────────────────────────────────
LINES = [21.5, 22.5, 23.5]

def under_rate(series):
    return {f'U{l}': (series < l).mean() for l in LINES}

def under_stats(group):
    n = len(group)
    rates = under_rate(group['total_games'])
    return pd.Series({'n': n, **rates})

# ── OVERALL ───────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("OVERALL UNDER RATES (best-of-3)")
print("="*60)
for tour_name, subset in [('ALL', bo3), ('ATP', bo3[bo3['tour']=='ATP']), ('WTA', bo3[bo3['tour']=='WTA'])]:
    r = under_rate(subset['total_games'])
    print(f"  {tour_name:5s}  n={len(subset):,}   " +
          "  ".join(f"U{l}: {r[f'U{l}']:.1%}" for l in LINES))

# ── BY SURFACE ────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("BY SURFACE")
print("="*60)
for tour_name, subset in [('ATP', bo3[bo3['tour']=='ATP']), ('WTA', bo3[bo3['tour']=='WTA'])]:
    print(f"\n  {tour_name}")
    grp = subset.groupby('Surface').apply(under_stats).reset_index()
    grp = grp[grp['n'] >= 200].sort_values('U22.5', ascending=False)
    for _, row in grp.iterrows():
        print(f"    {row['Surface']:12s}  n={int(row['n']):6,}   " +
              "  ".join(f"U{l}: {row[f'U{l}']:.1%}" for l in LINES))

# ── BY ROUND ──────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("BY ROUND")
print("="*60)
round_order = ['1st Round','2nd Round','3rd Round','4th Round',
               'Quarterfinals','Semifinals','The Final','Round Robin']
for tour_name, subset in [('ATP', bo3[bo3['tour']=='ATP']), ('WTA', bo3[bo3['tour']=='WTA'])]:
    print(f"\n  {tour_name}")
    grp = subset.groupby('Round').apply(under_stats).reset_index()
    grp = grp[grp['n'] >= 100]
    # sort by known round order
    grp['_order'] = grp['Round'].apply(lambda x: round_order.index(x) if x in round_order else 99)
    grp = grp.sort_values('_order')
    for _, row in grp.iterrows():
        print(f"    {row['Round']:15s}  n={int(row['n']):6,}   " +
              "  ".join(f"U{l}: {row[f'U{l}']:.1%}" for l in LINES))

# ── BY ATP SERIES TIER ────────────────────────────────────────────────────
print("\n" + "="*60)
print("ATP: BY SERIES TIER")
print("="*60)
atp_bo3 = bo3[bo3['tour']=='ATP']
grp = atp_bo3.groupby('Series').apply(under_stats).reset_index()
grp = grp[grp['n'] >= 100].sort_values('U22.5', ascending=False)
for _, row in grp.iterrows():
    print(f"  {row['Series']:30s}  n={int(row['n']):6,}   " +
          "  ".join(f"U{l}: {row[f'U{l}']:.1%}" for l in LINES))

# ── BY RANKING GAP ────────────────────────────────────────────────────────
print("\n" + "="*60)
print("BY RANKING GAP (Rank_1 - Rank_2)")
print("="*60)
bo3_ranked = bo3[(bo3['Rank_1'] > 0) & (bo3['Rank_2'] > 0)].copy()
bo3_ranked['rank_gap'] = (bo3_ranked['Rank_1'] - bo3_ranked['Rank_2']).abs()

bins = [0, 10, 25, 50, 100, 200, 99999]
labels = ['0-10 (even)', '11-25', '26-50', '51-100', '101-200', '200+']
bo3_ranked['gap_bucket'] = pd.cut(bo3_ranked['rank_gap'], bins=bins, labels=labels)

for tour_name, subset in [('ATP', bo3_ranked[bo3_ranked['tour']=='ATP']),
                           ('WTA', bo3_ranked[bo3_ranked['tour']=='WTA'])]:
    print(f"\n  {tour_name}")
    grp = subset.groupby('gap_bucket', observed=True).apply(under_stats).reset_index()
    grp = grp[grp['n'] >= 100]
    for _, row in grp.iterrows():
        print(f"    {str(row['gap_bucket']):18s}  n={int(row['n']):6,}   " +
              "  ".join(f"U{l}: {row[f'U{l}']:.1%}" for l in LINES))

# ── SURFACE × RANKING GAP (ATP, key combinations) ─────────────────────────
print("\n" + "="*60)
print("ATP: SURFACE × RANKING GAP (n>=150)")
print("="*60)
atp_ranked = bo3_ranked[bo3_ranked['tour']=='ATP'].copy()
grp = atp_ranked.groupby(['Surface','gap_bucket'], observed=True).apply(under_stats).reset_index()
grp = grp[grp['n'] >= 150].sort_values('U22.5', ascending=False)
for _, row in grp.iterrows():
    print(f"  {row['Surface']:10s} × {str(row['gap_bucket']):18s}  n={int(row['n']):5,}   " +
          "  ".join(f"U{l}: {row[f'U{l}']:.1%}" for l in LINES))

# ── ATP SERIES × SURFACE (n>=150) ─────────────────────────────────────────
print("\n" + "="*60)
print("ATP: SERIES TIER × SURFACE (n>=150)")
print("="*60)
grp = atp_bo3.groupby(['Series','Surface']).apply(under_stats).reset_index()
grp = grp[grp['n'] >= 150].sort_values('U22.5', ascending=False)
for _, row in grp.head(20).iterrows():
    print(f"  {row['Series']:25s} × {row['Surface']:8s}  n={int(row['n']):5,}   " +
          "  ".join(f"U{l}: {row[f'U{l}']:.1%}" for l in LINES))

# ── MEAN TOTAL GAMES by context (useful for line calibration) ─────────────
print("\n" + "="*60)
print("MEAN TOTAL GAMES by surface (BO3)")
print("="*60)
for tour_name, subset in [('ATP', bo3[bo3['tour']=='ATP']), ('WTA', bo3[bo3['tour']=='WTA'])]:
    print(f"\n  {tour_name}")
    grp = subset.groupby('Surface')['total_games'].agg(['mean','std','median','count']).round(2)
    grp = grp[grp['count'] >= 200].sort_values('mean')
    print(grp.to_string())

