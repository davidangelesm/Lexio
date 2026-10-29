import type { Alert } from "../types";
import { api } from "./http";
export const alertsService = {
  list(): Promise<Alert[]> {
    return api<Alert[]>("/alerts");
  },
  listScheduled(): Promise<Alert[]> {
    return api<Alert[]>("/alerts?all_scheduled=true");
  },
  read(id: number): Promise<unknown> {
    return api(`/alerts/${id}/read`, "POST");
  },
};
