export interface User {
  id: number;
  name: string;
  email?: string;
  role: "admin" | "staff";
  active: boolean;
  can_create_clients?: boolean;
  can_create_cases?: boolean;
}
export interface Client {
  id: number;
  code: string;
  document_type: string;
  document_number: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}
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
export interface FileLink {
  id: number;
  title: string;
  classification: string;
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
export interface Payment {
  id: number;
  service_id: number;
  payment_date: string;
  amount: string;
  method: string;
  receipt: string;
  observation: string;
  reversed_at: string | null;
  applied_amount?: string;
  credit?: string;
  case_id?: number;
  client?: Client;
  case_code?: string;
  applications?: { installment_id: number; amount: string }[];
}
export interface Installment {
  id: number;
  number: number;
  amount: string;
  condition: string;
  event_id: number | null;
  offset_days: number;
  day_basis: string;
  due_date: string | null;
  paid: string;
  balance: string;
  state: string;
  review_required: boolean;
  provisional_date: string | null;
  payments: Payment[];
}
export interface Service {
  id: number;
  case_id: number;
  mode: string;
  scope: string;
  stage: string;
  contract_date: string;
  fee?: string;
  installments?: Installment[];
  payments?: Payment[];
  client?: Client;
  case_code?: string;
}
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
export interface Area {
  area: string;
  total: number;
  activo: number;
  suspendido: number;
  concluido: number;
}
export interface Totals {
  contracted: string;
  applied: string;
  balance: string;
  overdue: string;
  not_due: string;
  pending_event: string;
  credit: string;
}
export interface Operational {
  areas: Area[];
  cases: Case[];
  entries: Entry[];
  tasks: Task[];
  date_basis: string;
}
export interface Economic {
  cutoff: string;
  totals: Totals;
  areas: (Area & Totals)[];
  services: Service[];
}
export interface Collections {
  received: string;
  credit: string;
  payments: Payment[];
}
export interface Access {
  id: number;
  user_id: number;
  level: string;
}
export interface Audit {
  id: number;
  created_at: string;
  user_id: number;
  resource: string;
  resource_id: number;
  action: string;
  changes: string;
}
