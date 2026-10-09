import type { Payment } from "../types";
import type { PaymentInput } from "../types/requests";
import { api } from "./http";
export const financeService = {
  recordPayment(caseId: number, data: PaymentInput): Promise<Payment> {
    return api<Payment>(`/cases/${caseId}/payments`, "POST", data);
  },
  removePayment(id: number): Promise<unknown> {
    return api(`/payments/${id}`, "DELETE");
  },
};
