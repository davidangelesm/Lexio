import type { Client, FileLink } from "../types";
import type { ClientInput, FileInput } from "../types/requests";
import { query } from "../utils/query";
import { api } from "./http";

export const clientsService = {
  list(filters: Record<string, string> = {}): Promise<Client[]> {
    return api<Client[]>(`/clients?${query(filters)}`, "GET");
  },
  save(id: number | undefined, data: ClientInput): Promise<Client> {
    return api<Client>(
      id === undefined ? `/clients` : `/clients/${id}`,
      id === undefined ? "POST" : "PUT",
      data,
    );
  },
  listFiles(id: number): Promise<FileLink[]> {
    return api<FileLink[]>(`/clients/${id}/files`, "GET");
  },
  createFile(id: number, data: FileInput): Promise<unknown> {
    return api<unknown>(`/clients/${id}/files`, "POST", data);
  },
};
