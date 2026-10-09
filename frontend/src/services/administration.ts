import type { Audit, User } from "../types";
import type { UserInput, UserUpdateInput } from "../types/requests";
import { api } from "./http";
export const administrationService = {
  listUsers(): Promise<User[]> {
    return api<User[]>("/users");
  },
  listAudit(): Promise<Audit[]> {
    return api<Audit[]>("/audit");
  },
  updateUser(id: number, data: UserUpdateInput): Promise<unknown> {
    return api(`/users/${id}`, "PUT", data);
  },
  createUser(data: UserInput): Promise<unknown> {
    return api("/users", "POST", data);
  },
};
