import type { Audit, User } from "../types";
import type {
  NoticeSettingsInput,
  UserInput,
  UserUpdateInput,
} from "../types/requests";
import { api } from "./http";

export const administrationService = {
  listUsers(): Promise<User[]> {
    return api<User[]>(`/users`, "GET");
  },
  listAudit(): Promise<Audit[]> {
    return api<Audit[]>(`/audit`, "GET");
  },
  getNoticeSettings(): Promise<{ days: number[] }> {
    return api<{ days: number[] }>(`/settings/notices`, "GET");
  },
  updateNoticeSettings(data: NoticeSettingsInput): Promise<unknown> {
    return api<unknown>(`/settings/notices`, "PUT", data);
  },
  updateUser(id: number, data: UserUpdateInput): Promise<unknown> {
    return api<unknown>(`/users/${id}`, "PUT", data);
  },
  createUser(data: UserInput): Promise<unknown> {
    return api<unknown>(`/users`, "POST", data);
  },
};
