import type { Access, Case, Entry } from "../types";
import type { AccessInput, CaseInput, EntryInput } from "../types/requests";
import { api } from "./http";
import { query } from "../utils/query";
export const casesService = {
  list(filters: Record<string, string> = {}): Promise<Case[]> {
    const params = query(filters);
    return api<Case[]>(`/cases${params ? `?${params}` : ""}`);
  },
  get(id: number): Promise<Case> {
    return api<Case>(`/cases/${id}`);
  },
  create(data: CaseInput): Promise<Case> {
    return api<Case>("/cases", "POST", data);
  },
  update(id: number, data: Partial<CaseInput>): Promise<Case> {
    return api<Case>(`/cases/${id}`, "PUT", data);
  },
  entries(id?: number): Promise<Entry[]> {
    return api<Entry[]>(id ? `/cases/${id}/entries` : "/entries");
  },
  addEntry(id: number, data: EntryInput): Promise<Entry> {
    return api<Entry>(`/cases/${id}/entries`, "POST", data);
  },
  updateEntry(id: number, data: EntryInput): Promise<Entry> {
    return api<Entry>(`/entries/${id}`, "PUT", data);
  },
  attendEntry(id: number): Promise<unknown> {
    return api(`/entries/${id}/attend`, "POST");
  },
  access(id: number): Promise<Access[]> {
    return api<Access[]>(`/cases/${id}/access`);
  },
  saveAccess(id: number, data: AccessInput): Promise<unknown> {
    return api(`/cases/${id}/access`, "POST", data);
  },
  removeAccess(id: number, userId: number): Promise<unknown> {
    return api(`/cases/${id}/access/${userId}`, "DELETE");
  },
};
