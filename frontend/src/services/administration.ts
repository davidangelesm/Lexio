import type { Audit, User } from "../types";
import type {
  ProfileUpdateInput,
  UserInput,
  UserUpdateInput,
} from "../types/requests";
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
  updateProfile(data: ProfileUpdateInput): Promise<User> {
    return api<User>("/auth/me", "PUT", data);
  },
  createUser(data: UserInput): Promise<unknown> {
    return api("/users", "POST", data);
  },
  removeUser(id: number): Promise<unknown> {
    return api(`/users/${id}`, "DELETE");
  },
};
