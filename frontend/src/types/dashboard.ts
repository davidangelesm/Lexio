export interface UpcomingPayment {
  id: number;
  case_id: number;
  case_code: string;
  process_type: string;
  client_code: string;
  client_name: string;
  number: number;
  due_date: string;
  amount: string;
  paid: string;
  balance: string;
  responsible_name: string;
}
export interface Dashboard {
  counts: {
    total_cases: number;
    active_cases: number;
    concluded_cases: number;
    pending_legal_alerts: number;
  };
  finance?: { fee: string; paid: string; balance: string };
  upcoming_payments?: UpcomingPayment[];
}
