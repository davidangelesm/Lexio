import type { Installment } from "../types";
import type {
  LinkInstallmentEventInput,
  PaymentApplicationsInput,
  PaymentInput,
  RescheduleInstallmentInput,
  ReversalInput,
} from "../types/requests";
import { api } from "./http";

export const financeService = {
  getPaymentProposal(id: number): Promise<Installment[]> {
    return api<Installment[]>(`/services/${id}/payment-proposal`, "GET");
  },
  confirmInstallment(id: number): Promise<unknown> {
    return api<unknown>(`/installments/${id}/confirm`, "POST");
  },
  applyCredit(
    id: number | undefined,
    data: PaymentApplicationsInput,
  ): Promise<unknown> {
    return api<unknown>(`/payments/${id}/apply`, "POST", data);
  },
  recordPayment(id: number, data: PaymentInput): Promise<unknown> {
    return api<unknown>(`/services/${id}/payments`, "POST", data);
  },
  linkInstallmentEvent(
    id: number,
    data: LinkInstallmentEventInput,
  ): Promise<unknown> {
    return api<unknown>(`/installments/${id}/event`, "PUT", data);
  },
  rescheduleInstallment(
    id: number,
    data: RescheduleInstallmentInput,
  ): Promise<unknown> {
    return api<unknown>(`/installments/${id}/reschedule`, "PUT", data);
  },
  reversePayment(
    id: number | undefined,
    data: ReversalInput,
  ): Promise<unknown> {
    return api<unknown>(`/payments/${id}/reverse`, "POST", data);
  },
};
