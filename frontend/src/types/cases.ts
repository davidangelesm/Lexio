import type { Client } from "./clients";
export interface Installment {
  id: number;
  number: number;
  amount: string;
  due_date: string;
  paid: string;
  balance: string;
  state: string;
}
export interface Payment {
  id: number;
  payment_date: string;
  amount: string;
  method: string;
  registered_by: number;
  created_at: string;
}
export interface Case {
  id: number;
  code: string;
  client_id: number;
  client: Client;
  area: string;
  process_type: string;
  initial_stage: string;
  status: "activo" | "concluido";
  responsible_id: number;
  responsible_name: string;
  created_at: string;
  access_level: "read" | "edit";
  fee?: string | null;
  paid?: string;
  balance?: string;
  cancelled?: boolean;
  installments?: Installment[];
  payments?: Payment[];
}
export interface Entry {
  id: number;
  case_id: number;
  action_date: string;
  description: string;
  alert_date: string | null;
  attended: boolean;
  registered_by: number;
  responsible_name: string;
  created_at: string;
  client_code: string;
  client_name: string;
  process_type: string;
  can_attend?: boolean;
}
