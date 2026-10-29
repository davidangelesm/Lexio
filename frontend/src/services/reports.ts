import type { Report } from "../types";
import { query } from "../utils/query";
import { api } from "./http";
export const reportsService = {
  list(filters: Record<string, string> = {}): Promise<Report> {
    const params = query(filters);
    return api<Report>(`/reports${params ? `?${params}` : ""}`);
  },
};
