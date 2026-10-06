import type { Dashboard } from "../types";
import { api } from "./http";

export const dashboardService = {
  list(): Promise<Dashboard> {
    return api<Dashboard>(`/dashboard`, "GET");
  },
};
