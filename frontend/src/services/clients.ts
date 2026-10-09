import type { Client } from "../types";
import type { ClientInput } from "../types/requests";
import { query } from "../utils/query";
import { api } from "./http";
export const clientsService = {
  list(filters: Record<string, string> = {}): Promise<Client[]> {
    const params = query(filters);
    return api<Client[]>(`/clients${params ? `?${params}` : ""}`);
  },
  create(data: ClientInput): Promise<Client> {
    return api<Client>("/clients", "POST", data);
  },
  update(id: number, data: ClientInput): Promise<Client> {
    return api<Client>(`/clients/${id}`, "PUT", data);
  },
};
