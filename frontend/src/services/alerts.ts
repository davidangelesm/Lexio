import type { Alert } from "../types";
import { api } from "./http";

export const alertsService = {
  list(): Promise<Alert[]> {
    return api<Alert[]>(`/alerts`, "GET");
  },
  read(id: number): Promise<unknown> {
    return api<unknown>(`/alerts/${id}/read`, "POST");
  },
};
