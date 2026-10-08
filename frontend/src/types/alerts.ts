import type { Event, Task } from "./cases";
import type { Client } from "./clients";

export interface Alert {
  id: number;
  case_id: number;
  kind: string;
  target_date: string;
  anticipation: number;
  read_at: string | null;
  description: string;
  responsible_id: number;
  client: Client;
  case_code: string;
  amount: string | null;
  label: string;
  provisional: boolean;
  urgent: boolean;
  can_attend: boolean;
}
export interface Dashboard {
  date: string;
  active_cases: number;
  procedural_alerts: number;
  payment_alerts?: number;
  payment_balance?: string;
  today_tasks: Task[];
  today_events: (Event & { case_id: number })[];
  alerts: Alert[];
  event_reviews?: {
    installment_id: number;
    case_id: number;
    description: string;
  }[];
}
