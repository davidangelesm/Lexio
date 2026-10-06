import { useEffect, useState } from "react";
import { casesService } from "../../../services/cases";
import { openPrivateFile } from "../../../services/files";
import { financeService } from "../../../services/finance";
import type {
  Access,
  Case,
  Entry,
  Event,
  FileLink,
  Installment,
  Service,
  Task,
  User,
} from "../../../types/index";
import { newPlan, type Plan } from "../models/installmentPlan";

export function useCaseWorkspace({
  selected,
  actor,
  users,
  back,
}: {
  selected: Case;
  actor: User;
  users: User[];
  back: () => void;
}) {
  const [caseData, setCaseData] = useState(selected);
  const [tab, setTab] = useState("bitacora");
  const [modal, setModal] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [files, setFiles] = useState<FileLink[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [access, setAccess] = useState<Access[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<Task>();
  const [editEntry, setEditEntry] = useState<Entry>();
  const [editEvent, setEditEvent] = useState<Event>();
  const [quota, setQuota] = useState<Installment>();
  const [service, setService] = useState<Service>();
  const [paymentId, setPaymentId] = useState<number>();
  const [plans, setPlans] = useState<Plan[]>([newPlan()]);
  const [percent, setPercent] = useState(false);
  const [allocations, setAllocations] = useState<Record<number, string>>({});
  const isAdmin = actor.role === "admin";
  const canEdit = caseData.access_level === "edit";
  const caseId = caseData.id;
  const userName = (id: number) =>
    users.find((x) => x.id === id)?.name || `Usuario ${id}`;
  const authorized = users.filter(
    (u) =>
      u.active &&
      (u.role === "admin" || access.some((a) => a.user_id === u.id)),
  );
  async function load() {
    setLoading(true);
    setError("");
    try {
      const [c, e, t, ev, f, s, a] = await Promise.all([
        casesService.get(caseId),
        casesService.listEntries(caseId),
        casesService.listTasks(caseId),
        casesService.listEvents(caseId),
        casesService.listFiles(caseId),
        casesService.listServices(caseId),
        isAdmin ? casesService.listAccess(caseId) : Promise.resolve([]),
      ]);
      setCaseData(c);
      setEntries(e);
      setTasks(t);
      setEvents(ev);
      setFiles(f);
      setServices(s);
      setAccess(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de conexión");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [selected.id]);
  async function done() {
    setModal("");
    await load();
  }
  async function action(work: () => Promise<unknown>) {
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }
  function updatePlan(index: number, change: Partial<Plan>) {
    setPlans((old) =>
      old.map((x, i) => (i === index ? { ...x, ...change } : x)),
    );
  }
  async function openFile(id: number) {
    await openPrivateFile(id);
  }
  async function beginPayment(s: Service) {
    try {
      const proposal = await financeService.getPaymentProposal(s.id);
      setService({ ...s, installments: proposal });
      setAllocations({});
      setPaymentId(undefined);
      setModal("abono");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }
  return {
    caseData,
    setCaseData,
    tab,
    setTab,
    modal,
    setModal,
    entries,
    setEntries,
    tasks,
    setTasks,
    events,
    setEvents,
    files,
    setFiles,
    services,
    setServices,
    access,
    setAccess,
    error,
    setError,
    loading,
    setLoading,
    editTask,
    setEditTask,
    editEntry,
    setEditEntry,
    editEvent,
    setEditEvent,
    quota,
    setQuota,
    service,
    setService,
    paymentId,
    setPaymentId,
    plans,
    setPlans,
    percent,
    setPercent,
    allocations,
    setAllocations,
    isAdmin,
    canEdit,
    caseId,
    userName,
    authorized,
    load,
    done,
    action,
    updatePlan,
    openFile,
    beginPayment,
    selected,
    actor,
    users,
    back,
  };
}
export type CaseWorkspaceState = ReturnType<typeof useCaseWorkspace>;
