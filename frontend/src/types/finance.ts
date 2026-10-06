import type { Client } from "./clients";

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
