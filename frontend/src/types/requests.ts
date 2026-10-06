export interface NoticeSettingsInput {
  days: number[];
}

export interface UserUpdateInput {
  active: boolean;
  password: string | null;
  name: string;
  can_create_clients: boolean;
  can_create_cases: boolean;
}

export interface UserInput {
  email: string;
  password: string;
  name: string;
  can_create_clients: boolean;
  can_create_cases: boolean;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CaseInput {
  client_id: number;
  area: string;
  subject: string;
  description: string;
  initial_stage: string;
  current_stage: string;
  start_date: string;
  responsible_id: number;
  reference: string;
}

export interface CaseUpdateInput {
  area: string;
  subject: string;
  description: string;
  current_stage: string;
  status: string;
  responsible_id: number;
  reference: string;
}

export interface EntryInput {
  action_date: string;
  description: string;
  is_payment_event: boolean;
}

export interface TaskInput {
  description: string;
  responsible_id: number;
  due_date: string;
  status: string;
  entry_id: number | null;
}

export interface EventInput {
  description: string;
  entry_id: number | null;
  scheduled_date: string | null;
  effective_date: string | null;
  effective_kind: string | null;
}

export interface FileInput {
  title: string;
  url: string;
  classification: string;
}

export interface AccessInput {
  user_id: number;
  level: string;
}

export interface ServiceInput {
  mode: string;
  scope: string;
  stage: string;
  contract_date: string;
  fee: string;
  installments: {
    amount: string | null;
    percentage: string | null;
    condition: string;
    due_date: string | null;
    event_id: number | null;
    offset_days: number;
    day_basis: string;
  }[];
}

export interface ClientInput {
  document_type: string;
  document_number: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

export interface PaymentApplicationsInput {
  applications: { installment_id: number; amount: string }[];
}

export interface PaymentInput {
  payment_date: string;
  amount: string;
  method: string;
  receipt: string;
  observation: string;
  applications: { installment_id: number; amount: string }[];
}

export interface LinkInstallmentEventInput {
  event_id: number;
}

export interface RescheduleInstallmentInput {
  due_date: string;
  reason: string;
}

export interface ReversalInput {
  reason: string;
}
