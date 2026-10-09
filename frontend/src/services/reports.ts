import type { Report } from "../types";
import { api } from "./http";
export const reportsService = {
  list(): Promise<Report> {
    return api<Report>("/reports");
  },
};
