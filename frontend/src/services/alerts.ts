import type { Alert } from "../types";
import { api } from "./http";
export const alertsService = {
  list(): Promise<Alert[]> {
    return api<Alert[]>("/alerts");
  },
  read(id: number): Promise<unknown> {
    return api(`/alerts/${id}/read`, "POST");
  },
};
