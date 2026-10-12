export interface ReportTotals {
  total_cases: number;
  active_cases: number;
  concluded_cases: number;
  withdrawn_cases: number;
  fee?: string;
  paid?: string;
  balance?: string;
  uncollectible?: string;
}
export interface ReportRow extends ReportTotals {
  area_id: number;
  area: string;
}
export interface Report {
  rows: ReportRow[];
  totals: ReportTotals;
}
