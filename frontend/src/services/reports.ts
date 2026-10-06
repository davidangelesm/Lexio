import type { Collections, Economic, Operational } from "../types";
import { query } from "../utils/query";
import { api } from "./http";

export const reportsService = {
  operational(filters: Record<string, string>): Promise<Operational> {
    return api<Operational>(`/reports/operational?${query(filters)}`, "GET");
  },
  collections(filters: Record<string, string>): Promise<Collections> {
    return api<Collections>(`/reports/collections?${query(filters)}`, "GET");
  },
  economic(filters: Record<string, string>): Promise<Economic> {
    return api<Economic>(`/reports/economic?${query(filters)}`, "GET");
  },
};
