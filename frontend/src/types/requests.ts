export interface LoginInput {
  username: string;
  password: string;
}
export interface UserInput {
  username: string;
  password: string;
  name: string;
  can_create_clients: boolean;
  can_create_cases: boolean;
}
export interface UserUpdateInput extends Omit<UserInput, "password"> {
  active: boolean;
  password: string | null;
}
export interface ClientInput {
  document_type: string;
  document_number: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}
export interface InstallmentInput {
  id?: number;
  amount: string;
  due_date: string;
}
export interface CaseInput {
  client_id: number;
  area_id: number;
  process_type: string;
  initial_stage: string;
  status: "activo" | "concluido";
  responsible_id?: number;
  fee?: string;
  installments?: InstallmentInput[];
}
export interface EntryInput {
  action_date: string;
  subject: string;
  subject_type: "legal" | "otro";
  description: string;
  alert_date: string | null;
}
export interface PaymentInput {
  payment_date: string;
  amount: string;
  method: string;
  installment_id?: number;
}
export interface AccessInput {
  user_id: number;
  level: string;
}
