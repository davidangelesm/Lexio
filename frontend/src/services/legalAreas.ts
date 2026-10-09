import type { LegalArea } from "../types";
import { api } from "./http";

export const legalAreasService = {
  list(): Promise<LegalArea[]> {
    return api<LegalArea[]>("/legal-areas");
  },
};
