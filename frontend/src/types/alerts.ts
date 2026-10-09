export interface Alert {
  id: number;
  case_id: number;
  client_code: string;
  client_name: string;
  case_code: string;
  process_type: string;
  kind: "legal" | "otro" | "pago";
  subject?: string;
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
