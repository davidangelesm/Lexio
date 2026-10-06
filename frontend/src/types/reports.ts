import type { Case, Entry, Task } from "./cases";
import type { Payment, Service } from "./finance";

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
