import type {
  Access,
  Case,
  Entry,
  Event,
  FileLink,
  Service,
  Task,
} from "../types";
import type {
  AccessInput,
  CaseInput,
  CaseUpdateInput,
  EntryInput,
  EventInput,
  FileInput,
  ServiceInput,
  TaskInput,
} from "../types/requests";
import { query } from "../utils/query";
import { api } from "./http";

export const casesService = {
  list(filters: Record<string, string> = {}): Promise<Case[]> {
    return api<Case[]>(`/cases?${query(filters)}`, "GET");
  },
  get(id: number | string): Promise<Case> {
    return api<Case>(`/cases/${id}`, "GET");
  },
  create(data: CaseInput): Promise<Case> {
    return api<Case>(`/cases`, "POST", data);
  },
  listEntries(caseId: number): Promise<Entry[]> {
    return api<Entry[]>(`/cases/${caseId}/entries`, "GET");
  },
  listTasks(caseId: number): Promise<Task[]> {
    return api<Task[]>(`/cases/${caseId}/tasks`, "GET");
  },
  listEvents(caseId: number): Promise<Event[]> {
    return api<Event[]>(`/cases/${caseId}/events`, "GET");
  },
  listFiles(caseId: number): Promise<FileLink[]> {
    return api<FileLink[]>(`/cases/${caseId}/files`, "GET");
  },
  listServices(caseId: number | string): Promise<Service[]> {
    return api<Service[]>(`/cases/${caseId}/services`, "GET");
  },
  listAccess(caseId: number): Promise<Access[]> {
    return api<Access[]>(`/cases/${caseId}/access`, "GET");
  },
  reviewEvent(caseId: number, relatedId: number): Promise<unknown> {
    return api<unknown>(`/cases/${caseId}/events/${relatedId}/review`, "POST");
  },
  revokeAccess(caseId: number, relatedId: number): Promise<unknown> {
    return api<unknown>(`/cases/${caseId}/access/${relatedId}`, "DELETE");
  },
  update(caseId: number, data: CaseUpdateInput): Promise<unknown> {
    return api<unknown>(`/cases/${caseId}`, "PUT", data);
  },
  saveEntry(
    caseId: number,
    id: number | undefined,
    data: EntryInput,
  ): Promise<unknown> {
    return api<unknown>(
      id === undefined
        ? `/cases/${caseId}/entries`
        : `/cases/${caseId}/entries/${id}`,
      id === undefined ? "POST" : "PUT",
      data,
    );
  },
  saveTask(
    caseId: number,
    id: number | undefined,
    data: TaskInput,
  ): Promise<unknown> {
    return api<unknown>(
      id === undefined
        ? `/cases/${caseId}/tasks`
        : `/cases/${caseId}/tasks/${id}`,
      id === undefined ? "POST" : "PUT",
      data,
    );
  },
  saveEvent(
    caseId: number,
    id: number | undefined,
    data: EventInput,
  ): Promise<unknown> {
    return api<unknown>(
      id === undefined
        ? `/cases/${caseId}/events`
        : `/cases/${caseId}/events/${id}`,
      id === undefined ? "POST" : "PUT",
      data,
    );
  },
  createFile(caseId: number, data: FileInput): Promise<unknown> {
    return api<unknown>(`/cases/${caseId}/files`, "POST", data);
  },
  grantAccess(caseId: number, data: AccessInput): Promise<unknown> {
    return api<unknown>(`/cases/${caseId}/access`, "POST", data);
  },
  createService(caseId: number, data: ServiceInput): Promise<unknown> {
    return api<unknown>(`/cases/${caseId}/services`, "POST", data);
  },
};
