// Valid first-set game totals in tennis.
// 6=6-0, 7=6-1, 8=6-2, 9=6-3, 10=6-4, 12=7-5, 13=7-6(TB)
// 11 is impossible (no 5-6 final score). Anything else = retirement/walkover.
export const VALID_SET_TOTALS = [6, 7, 8, 9, 10, 12, 13] as const;

// All first-set total lines Pinnacle offers.
export const LINES = [6.5, 7.5, 8.5, 9.5, 10.5, 12.5] as const;

export interface LineSnapshot {
  line: number;
  closing_over: number;
  closing_under: number;
  opening_over: number;
  opening_under: number;
}

export interface FirstSetRecord {
  event_id: number;
  date: string;
  league: string;
  region: string;
  home: string;
  away: string;
  set1_home: number;
  set1_away: number;
  set1_total: number;
  match_total: number;
  lines: LineSnapshot[];
  match_lines: LineSnapshot[];
}

export interface LineAnalysis {
  line: number;
  n: number;
  over_hits: number;
  under_hits: number;
  over_rate: number;
  under_rate: number;
  avg_implied_over: number;
  avg_implied_under: number;
  edge_over: number;
  edge_under: number;
  z_over: number;
  z_under: number;
  avg_vig: number;
}
