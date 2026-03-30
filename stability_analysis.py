import pandas as pd
import numpy as np
import re
import warnings
warnings.filterwarnings('ignore')

def parse_total_games(score):
    if not isinstance(score, str): return None
    score = re.sub(r'\[\d+\]', '', score.strip())
    sets = re.findall(r'(\d+)-(\d+)', score)
    if not sets: return None
    total = sum(int(a)+int(b) for a,b in sets)
    return total if total >= 12 else None

atp = pd.read_csv('/home/user/Data/archive_atp/atp_tennis.csv')
wta = pd.read_csv('/home/user/Data/archive_wta/wta.csv', low_memory=False)

for d in [atp, wta]:
    d['total_games'] = d['Score'].apply(parse_total_games)
    d['Date'] = pd.to_datetime(d['Date'], errors='coerce')
    d['year'] = d['Date'].dt.year.astype('Int64')

atp_bo3 = atp[(atp['total_games'].notna()) & (atp['Best of']==3)].copy()
wta_bo3 = wta[(wta['total_games'].notna()) & (wta['Best of']==3)].copy()

atp['Series'] = atp['Series'].fillna('')
wta['Series'] = 'WTA'

LINES = [21.5, 22.5, 23.5]

def yr_table(df, label):
    print(f"\n{'='*70}")
    print(f"YEAR-BY-YEAR UNDER RATES — {label} (BO3)")
    print(f"{'='*70}")
    grp = df.groupby('year')['total_games'].agg(
        n='count', mean='mean',
        U21_5=lambda x: (x<21.5).mean(),
        U22_5=lambda x: (x<22.5).mean(),
        U23_5=lambda x: (x<23.5).mean(),
    ).reset_index()
    for _, r in grp[grp['n']>=100].iterrows():
        trend = ''
        print(f"  {int(r['year'])}  n={int(r['n']):4,}  mean={r['mean']:.2f}  "
              f"U21.5:{r['U21_5']:.1%}  U22.5:{r['U22_5']:.1%}  U23.5:{r['U23_5']:.1%}")

yr_table(atp_bo3, 'ATP')
yr_table(wta_bo3, 'WTA')

# ── SEGMENT STABILITY ─────────────────────────────────────────────────────
def seg_stability(df, label, line=22.5):
    print(f"\n{'='*70}")
    print(f"STABILITY — {label}  (U{line})")
    print(f"{'='*70}")
    grp = df.groupby('year')['total_games'].agg(
        n='count', rate=lambda x: (x<line).mean()
    ).reset_index()
    for _, r in grp[grp['n']>=25].iterrows():
        bar = '█' * int(r['rate']*20)
        print(f"  {int(r['year'])}  n={int(r['n']):4,}  {r['rate']:.1%}  {bar}")

# WTA 200+ ranking gap
wta_ranked = wta_bo3[(wta_bo3['Rank_1']>0) & (wta_bo3['Rank_2']>0)].copy()
wta_ranked['rank_gap'] = (wta_ranked['Rank_1'] - wta_ranked['Rank_2']).abs()
seg_stability(wta_ranked[wta_ranked['rank_gap']>200], "WTA 200+ Ranking Gap")

# WTA 51-100 gap (larger sample)
seg_stability(wta_ranked[(wta_ranked['rank_gap']>=51) & (wta_ranked['rank_gap']<=100)],
              "WTA 51-100 Ranking Gap")

# ATP International/Gold × Clay
seg_stability(atp_bo3[atp_bo3['Series'].isin(['International','International Gold']) &
              (atp_bo3['Surface']=='Clay')], "ATP International × Clay")

# ATP Hard × 200+ gap
atp_ranked = atp_bo3[(atp_bo3['Rank_1']>0) & (atp_bo3['Rank_2']>0)].copy()
atp_ranked['rank_gap'] = (atp_ranked['Rank_1'] - atp_ranked['Rank_2']).abs()
seg_stability(atp_ranked[(atp_ranked['rank_gap']>200) & (atp_ranked['Surface']=='Hard')],
              "ATP Hard × 200+ Gap")

# ── DRIFT SUMMARY ──────────────────────────────────────────────────────────
print(f"\n{'='*70}")
print("DRIFT SUMMARY — 3-YEAR ROLLING MEAN TOTAL GAMES")
print(f"{'='*70}")
for label, df in [('ATP', atp_bo3), ('WTA', wta_bo3)]:
    yrmean = df.groupby('year')['total_games'].mean()
    yrmean = yrmean[yrmean.index >= 2007]
    rolling = yrmean.rolling(3, min_periods=2).mean()
    print(f"\n  {label}:")
    for yr_val, val in rolling.items():
        if not np.isnan(val):
            bar = '─' * int((val - 18) * 3)
            print(f"    {int(yr_val)}  {val:.2f}  {bar}")

# ── RECENT 5 YEARS vs HISTORICAL ──────────────────────────────────────────
print(f"\n{'='*70}")
print("RECENT (2021-2026) vs HISTORICAL (pre-2021) — key segments")
print(f"{'='*70}")
for label, df in [('ATP overall', atp_bo3), ('WTA overall', wta_bo3)]:
    hist = df[df['year']<2021]['total_games']
    rec  = df[df['year']>=2021]['total_games']
    print(f"\n  {label}")
    print(f"    Historical  n={len(hist):,}  mean={hist.mean():.2f}  U22.5:{(hist<22.5).mean():.1%}")
    print(f"    Recent      n={len(rec):,}   mean={rec.mean():.2f}  U22.5:{(rec<22.5).mean():.1%}")

# WTA 200+ gap recent vs historical
wta_200 = wta_ranked[wta_ranked['rank_gap']>200]
hist = wta_200[wta_200['year']<2021]['total_games']
rec  = wta_200[wta_200['year']>=2021]['total_games']
print(f"\n  WTA 200+ gap")
print(f"    Historical  n={len(hist):,}  mean={hist.mean():.2f}  U22.5:{(hist<22.5).mean():.1%}")
print(f"    Recent      n={len(rec):,}   mean={rec.mean():.2f}  U22.5:{(rec<22.5).mean():.1%}")

