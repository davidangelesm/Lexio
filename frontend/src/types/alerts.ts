export interface Alert {
  id: number;
  case_id: number;
  client_code: string;
  client_name: string;
  kind: "legal" | "pago";
  description: string;
  target_date: string;
  notice_date: string;
  anticipation: number;
  urgent: boolean;
  responsible_name: string;
  balance?: string | null;
  entry_id?: number;
  can_attend: boolean;
}
