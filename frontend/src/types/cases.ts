import type { Client } from "./clients";
export type CaseTab = "bitacora" | "finanzas";
export interface LegalArea {
  id: number;
  name: string;
}
export interface Installment {
  id: number;
  number: number;
  amount: string;
  due_date: string | null;
  event_name?: string | null;
  activated_at?: string | null;
  entry_id?: number | null;
  paid: string;
  balance: string;
  state: string;
  uncollectible_reason?: string | null;
  uncollectible_at?: string | null;
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
  client_ids?: number[];
  client: Client;
  clients?: Client[];
  area_id: number;
  area: string;
  process_type: string;
  tracking_number?: string;
  initial_stage: string;
  status: "activo" | "concluido" | "retirado";
  responsible_id: number;
  responsible_name: string;
  created_at: string;
  access_level: "read" | "edit";
  fee?: string | null;
  paid?: string;
  balance?: string;
  uncollectible?: string;
  cancelled?: boolean;
  installments?: Installment[];
  payments?: Payment[];
}
export interface Entry {
  id: number;
  case_id: number;
  action_date: string;
  subject: string;
  subject_type: "legal" | "otro";
  description: string;
  alert_date: string | null;
  alert_time?: string | null;
  attended: boolean;
  registered_by: number;
  responsible_name: string;
  created_at: string;
  client_code: string;
  client_name: string;
  client_document_type?: string;
  client_document_number?: string;
  process_type: string;
  can_attend?: boolean;
  payment_installment_id?: number | null;
  payment_event?: string;
  payment_activated?: boolean;
}
