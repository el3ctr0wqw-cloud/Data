import pandas as pd
import numpy as np
import warnings
warnings.filterwarnings('ignore')

# ── Load data ──────────────────────────────────────────────────────────────────
atp = pd.read_csv('/home/user/Data/archive_atp/atp_tennis.csv', low_memory=False)
wta = pd.read_csv('/home/user/Data/archive_wta/wta.csv', low_memory=False)

print("="*70)
print("TENNIS ODDS ANALYSIS — ATP & WTA")
print("="*70)

# ── 1. Basic shape ─────────────────────────────────────────────────────────────
print(f"\n[DATASET SHAPE]")
print(f"  ATP rows: {len(atp):,}   columns: {atp.shape[1]}")
print(f"  WTA rows: {len(wta):,}   columns: {wta.shape[1]}")
print(f"\n  ATP columns: {list(atp.columns)}")
print(f"  WTA columns: {list(wta.columns)}")

# ── 2. Date ranges ─────────────────────────────────────────────────────────────
atp['Date'] = pd.to_datetime(atp['Date'], errors='coerce')
wta['Date'] = pd.to_datetime(wta['Date'], errors='coerce')

print(f"\n[1. DATE RANGES]")
print(f"  ATP: {atp['Date'].min().date()}  →  {atp['Date'].max().date()}")
print(f"  WTA: {wta['Date'].min().date()}  →  {wta['Date'].max().date()}")

# ── 3. Valid vs missing odds ───────────────────────────────────────────────────
def odds_stats(df, name):
    df['Odd_1'] = pd.to_numeric(df['Odd_1'], errors='coerce')
    df['Odd_2'] = pd.to_numeric(df['Odd_2'], errors='coerce')
    valid = df[(df['Odd_1'] > 0) & (df['Odd_2'] > 0)].copy()
    missing = df[~((df['Odd_1'] > 0) & (df['Odd_2'] > 0))]
    print(f"\n  {name}:")
    print(f"    Total matches      : {len(df):,}")
    print(f"    Valid odds (both>0): {len(valid):,}  ({100*len(valid)/len(df):.1f}%)")
    print(f"    Missing/zero odds  : {len(missing):,}  ({100*len(missing)/len(df):.1f}%)")
    return valid

print(f"\n[2. VALID VS MISSING ODDS]")
atp_v = odds_stats(atp, "ATP")
wta_v = odds_stats(wta, "WTA")

# ── 4. Core valid-odds analysis ────────────────────────────────────────────────
def core_analysis(df, name):
    df = df.copy()
    # Determine favorite (lower decimal odds = more likely to win)
    df['fav_player'] = np.where(df['Odd_1'] <= df['Odd_2'], 'Player_1', 'Player_2')
    df['fav_won']    = (
        ((df['fav_player'] == 'Player_1') & (df['Winner'] == df['Player_1'])) |
        ((df['fav_player'] == 'Player_2') & (df['Winner'] == df['Player_2']))
    )
    fav_win_pct = df['fav_won'].mean() * 100

    print(f"\n  ── {name} ──")
    print(f"    Favorite win rate : {fav_win_pct:.2f}%")

    # Odds distribution
    for col in ['Odd_1', 'Odd_2']:
        s = df[col]
        print(f"    {col}: min={s.min():.2f}  max={s.max():.2f}  "
              f"mean={s.mean():.3f}  median={s.median():.3f}")

    # Implied probability accuracy
    df['imp_prob_fav'] = np.where(
        df['fav_player'] == 'Player_1',
        1 / df['Odd_1'],
        1 / df['Odd_2']
    )
    df['imp_prob_dog'] = np.where(
        df['fav_player'] == 'Player_1',
        1 / df['Odd_2'],
        1 / df['Odd_1']
    )
    # bin implied probability and compare to actual win rate
    bins = [0, 0.40, 0.50, 0.60, 0.70, 0.80, 1.01]
    labels = ['<40%', '40-50%', '50-60%', '60-70%', '70-80%', '>80%']
    df['prob_bin'] = pd.cut(df['imp_prob_fav'], bins=bins, labels=labels, right=False)
    cal = df.groupby('prob_bin', observed=True)['fav_won'].agg(['mean', 'count'])
    cal.columns = ['actual_win_rate', 'n_matches']
    cal['actual_win_rate'] = (cal['actual_win_rate'] * 100).round(2)
    print(f"\n    Implied-prob calibration (favorite):")
    print(f"    {'Implied Prob Bin':<14} {'Actual Win%':>12} {'N matches':>10}")
    for idx, row in cal.iterrows():
        print(f"    {str(idx):<14} {row['actual_win_rate']:>11.2f}% {int(row['n_matches']):>10,}")

    # ROI — bet 1 unit on favorite every match
    df['fav_odd'] = np.where(df['fav_player'] == 'Player_1', df['Odd_1'], df['Odd_2'])
    df['dog_odd'] = np.where(df['fav_player'] == 'Player_1', df['Odd_2'], df['Odd_1'])
    n = len(df)
    fav_profit = df.apply(lambda r: r['fav_odd'] - 1 if r['fav_won'] else -1, axis=1).sum()
    dog_profit = df.apply(lambda r: r['dog_odd'] - 1 if not r['fav_won'] else -1, axis=1).sum()
    roi_fav = fav_profit / n * 100
    roi_dog = dog_profit / n * 100
    print(f"\n    ROI (1-unit flat bet, {n:,} matches):")
    print(f"      Always bet favorite  : {roi_fav:+.3f}%  (total P&L: {fav_profit:+.2f} units)")
    print(f"      Always bet underdog  : {roi_dog:+.3f}%  (total P&L: {dog_profit:+.2f} units)")

    # Overround (vig)
    df['overround'] = (1/df['Odd_1'] + 1/df['Odd_2'])
    print(f"\n    Bookmaker overround (margin):")
    print(f"      Mean : {df['overround'].mean():.4f}  ({(df['overround'].mean()-1)*100:.2f}%  margin)")
    print(f"      Median: {df['overround'].median():.4f}  ({(df['overround'].median()-1)*100:.2f}% margin)")

    return df

print(f"\n[3. VALID-ODDS CORE ANALYSIS]")
atp_a = core_analysis(atp_v, "ATP")
wta_a = core_analysis(wta_v, "WTA")

# ── 5. Upset analysis by surface & round ──────────────────────────────────────
def upset_analysis(df, name):
    df = df.copy()
    df['upset'] = ~df['fav_won']

    print(f"\n  ── {name} ──")

    # Surface
    surf = df.groupby('Surface', observed=True)['upset'].agg(['mean','count'])
    surf.columns = ['upset_rate', 'n']
    surf['upset_rate'] = (surf['upset_rate']*100).round(2)
    surf = surf.sort_values('upset_rate', ascending=False)
    print(f"\n    Upset rate by Surface:")
    print(f"    {'Surface':<12} {'Upset%':>8} {'N':>8}")
    for s, r in surf.iterrows():
        print(f"    {str(s):<12} {r['upset_rate']:>7.2f}% {int(r['n']):>8,}")

    # Round
    round_order = ['1st Round','2nd Round','3rd Round','4th Round',
                   'Quarterfinals','Semifinals','The Final','Final',
                   'Round Robin']
    rnd = df.groupby('Round', observed=True)['upset'].agg(['mean','count'])
    rnd.columns = ['upset_rate', 'n']
    rnd['upset_rate'] = (rnd['upset_rate']*100).round(2)
    # sort by known order where possible
    rnd['sort_key'] = rnd.index.map(
        lambda x: round_order.index(x) if x in round_order else 99)
    rnd = rnd.sort_values('sort_key')
    print(f"\n    Upset rate by Round:")
    print(f"    {'Round':<20} {'Upset%':>8} {'N':>8}")
    for r, row in rnd.iterrows():
        print(f"    {str(r):<20} {row['upset_rate']:>7.2f}% {int(row['n']):>8,}")

print(f"\n[4. UPSET ANALYSIS]")
upset_analysis(atp_a, "ATP")
upset_analysis(wta_a, "WTA")

# ── 6. Interesting patterns ────────────────────────────────────────────────────
def patterns(df, name):
    print(f"\n  ── {name} ──")

    # Heavy favorites (odds < 1.20)
    heavy = df[df['fav_odd'] < 1.20]
    if len(heavy):
        print(f"\n    Heavy favorites (odds < 1.20):  n={len(heavy):,}")
        print(f"      Win rate : {heavy['fav_won'].mean()*100:.2f}%")
        print(f"      ROI      : {((heavy.apply(lambda r: r['fav_odd']-1 if r['fav_won'] else -1, axis=1).sum())/len(heavy))*100:+.3f}%")

    # Coin-flip matches (odds 1.80–2.20)
    coin = df[(df['Odd_1'].between(1.80, 2.20)) & (df['Odd_2'].between(1.80, 2.20))]
    if len(coin):
        fav_wr = coin['fav_won'].mean()*100
        print(f"\n    Near-even matches (both odds 1.80–2.20): n={len(coin):,}")
        print(f"      Favorite win rate: {fav_wr:.2f}%  (expected ~50%)")

    # Biggest upsets (underdog odds > 5.0 and underdog won)
    big_upsets = df[(df['dog_odd'] > 5.0) & (~df['fav_won'])]
    print(f"\n    Massive upsets (underdog odds >5.0 that won): n={len(big_upsets):,}")
    if len(big_upsets):
        print(f"      Avg underdog odds in those upsets: {big_upsets['dog_odd'].mean():.2f}")
        print(f"      Max underdog odds (biggest upset): {big_upsets['dog_odd'].max():.2f}")

    # Year-over-year favorite win rate
    if 'Date' in df.columns:
        df2 = df.copy()
        df2['year'] = df2['Date'].dt.year
        yr = df2.groupby('year')['fav_won'].agg(['mean','count'])
        yr.columns = ['fav_win_rate','n']
        yr['fav_win_rate'] = (yr['fav_win_rate']*100).round(2)
        print(f"\n    Favorite win rate by year:")
        print(f"    {'Year':>6} {'Fav Win%':>10} {'N':>8}")
        for y, row in yr.iterrows():
            print(f"    {int(y):>6} {row['fav_win_rate']:>9.2f}% {int(row['n']):>8,}")

print(f"\n[5. INTERESTING PATTERNS]")
patterns(atp_a, "ATP")
patterns(wta_a, "WTA")

print("\n" + "="*70)
print("ANALYSIS COMPLETE")
print("="*70)
