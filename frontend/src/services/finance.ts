import type { Case, Payment } from "../types";
import type { PaymentInput } from "../types/requests";
import { api } from "./http";
export const financeService = {
  updateCollections(
    caseId: number,
    installmentIds: number[],
    reason: string | null,
  ): Promise<Case> {
    return api<Case>(`/cases/${caseId}/collection`, "PUT", {
      installment_ids: installmentIds,
      reason,
    });
  },
  recordPayment(caseId: number, data: PaymentInput): Promise<Payment> {
    return api<Payment>(`/cases/${caseId}/payments`, "POST", data);
  },
  removePayment(id: number): Promise<unknown> {
    return api(`/payments/${id}`, "DELETE");
  },
};
