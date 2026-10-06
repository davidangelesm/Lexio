import type { Client } from "./clients";

export interface Case {
  id: number;
  code: string;
  client_id: number;
  client: Client;
  area: string;
  subject: string;
  description: string;
  initial_stage: string;
  current_stage: string;
  status: string;
  start_date: string;
  responsible_id: number;
  reference: string;
  access_level: "read" | "edit";
}
export interface Entry {
  id: number;
  case_id: number;
  action_date: string;
  description: string;
  created_at: string;
  registered_by: number;
  is_payment_event: boolean;
  client?: Client;
  case_code?: string;
}
export interface Task {
  id: number;
  case_id: number;
  entry_id: number | null;
  description: string;
  due_date: string;
  responsible_id: number;
  status: string;
  client?: Client;
  case_code?: string;
}
export interface Event {
  id: number;
  description: string;
  entry_id: number | null;
  scheduled_date: string | null;
  effective_date: string | null;
  effective_kind: string | null;
  revision: number;
  reviewed_revision: number;
}
