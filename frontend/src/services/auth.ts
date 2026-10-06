import type { User } from "../types";
import type { LoginInput } from "../types/requests";
import { api } from "./http";

export const authService = {
  login(data: LoginInput): Promise<{ access_token: string; user: User }> {
    return api<{ access_token: string; user: User }>(
      `/auth/login`,
      "POST",
      data,
    );
  },
};
