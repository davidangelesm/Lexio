export interface ReportTotals {
  total_cases: number;
  active_cases: number;
  concluded_cases: number;
  fee?: string;
  paid?: string;
  balance?: string;
}
export interface ReportRow extends ReportTotals {
  area: string;
}
export interface Report {
  rows: ReportRow[];
  totals: ReportTotals;
}
