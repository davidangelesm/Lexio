import { useEffect, useRef, useState } from "react";
import { administrationService } from "../services/administration";
import { alertsService } from "../services/alerts";
import { casesService } from "../services/cases";
import { clientsService } from "../services/clients";
import { dashboardService } from "../services/dashboard";
import { reportsService } from "../services/reports";
import { setToken } from "../services/http";
import type {
  Alert,
  Audit,
  Case,
  Client,
  Dashboard,
  Report,
  User,
} from "../types";
export function useLexio() {
  const [actor, setActorState] = useState<User>();
  const session = useRef(0);
  const request = useRef(0);
  const [page, setPageState] = useState("inicio");
  const [selected, setSelectedState] = useState<Case>();
  const [modal, setModalState] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [audit, setAudit] = useState<Audit[]>([]);
  const [report, setReport] = useState<Report>();
  const [editUser, setEditUser] = useState<User>();
  const [editClient, setEditClient] = useState<Client>();
  const [newCaseClientId, setNewCaseClientId] = useState<number>();
  const [clientSearch, setClientSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [search, setSearch] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = actor?.role === "admin";
  const renderSession = session.current;
  function setPage(value: string) {
    if (renderSession === session.current) setPageState(value);
  }
  function setSelected(item?: Case) {
    if (renderSession === session.current) setSelectedState(item);
  }
  function setModal(value: string) {
    if (renderSession === session.current) setModalState(value);
  }
  function setActor(user: User) {
    session.current += 1;
    setActorState(user);
  }
  function logout() {
    session.current += 1;
    request.current += 1;
    setToken("");
    setActorState(undefined);
    setSelectedState(undefined);
    setCases([]);
    setClients([]);
    setUsers([]);
    setAlerts([]);
    setDashboard(undefined);
    setAudit([]);
    setReport(undefined);
    setEditClient(undefined);
    setEditUser(undefined);
    setNewCaseClientId(undefined);
    setModalState("");
    setSearch("");
    setArea("");
    setStatus("");
    setClientSearch("");
    setClientFilter("");
    setPageState("inicio");
    setBusy(false);
  }
  useEffect(() => {
    window.addEventListener("lexio-session-expired", logout);
    return () => window.removeEventListener("lexio-session-expired", logout);
  }, []);
  async function load(
    filters = { search, area, status, client_id: clientFilter },
  ) {
    if (!actor || renderSession !== session.current) return;
    const currentSession = session.current;
    const currentRequest = ++request.current;
    const isCurrent = () =>
      currentSession === session.current && currentRequest === request.current;
    setBusy(true);
    setError("");
    try {
      const [team, clientList, caseList, summary, notices, metrics, history] =
        await Promise.all([
          administrationService.listUsers(),
          clientsService.list(),
          casesService.list(page === "casos" ? filters : {}),
          page === "inicio"
            ? dashboardService.get()
            : Promise.resolve(undefined),
          page === "alertas" || page === "inicio"
            ? alertsService.list()
            : Promise.resolve(undefined),
          page === "reportes"
            ? reportsService.list()
            : Promise.resolve(undefined),
          page === "usuarios" && isAdmin
            ? administrationService.listAudit()
            : Promise.resolve(undefined),
        ]);
      if (!isCurrent()) return;
      setUsers(team);
      setClients(clientList);
      setCases(caseList);
      if (summary) setDashboard(summary);
      if (notices) setAlerts(notices);
      if (metrics) setReport(metrics);
      if (history) setAudit(history);
    } catch (e) {
      if (isCurrent())
        setError(
          e instanceof Error ? e.message : "No se pudo cargar la información.",
        );
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  useEffect(() => {
    if (actor) void load();
  }, [actor?.id, page]);
  useEffect(() => {
    if (!actor || !["inicio", "alertas"].includes(page) || selected) return;
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [actor?.id, page, selected]);
  async function openCase(id: number) {
    if (renderSession !== session.current) return;
    const currentSession = session.current;
    const currentRequest = ++request.current;
    const isCurrent = () =>
      currentSession === session.current && currentRequest === request.current;
    setBusy(true);
    setError("");
    try {
      const item = await casesService.get(id);
      if (isCurrent()) setSelected(item);
    } catch (e) {
      if (isCurrent())
        setError(e instanceof Error ? e.message : "No se pudo abrir el caso.");
    } finally {
      if (isCurrent()) setBusy(false);
    }
  }
  async function done() {
    setModal("");
    await load();
  }
  function clearFilters() {
    setSearch("");
    setArea("");
    setStatus("");
    setClientFilter("");
    void load({ search: "", area: "", status: "", client_id: "" });
  }
  function viewClientCases(client: Client) {
    setSearch("");
    setArea("");
    setStatus("");
    setClientFilter(String(client.id));
    setSelected(undefined);
    setModal("");
    setPage("casos");
    if (page === "casos")
      void load({
        search: "",
        area: "",
        status: "",
        client_id: String(client.id),
      });
  }
  function newCase(client?: Client) {
    setNewCaseClientId(
      client?.id ?? (clientFilter ? Number(clientFilter) : undefined),
    );
    setModal("caso");
  }
  function createClient() {
    setEditClient(undefined);
    setModal("cliente");
  }
  function correctClient(client: Client) {
    setEditClient(client);
    setModal("cliente");
  }
  return {
    actor,
    setActor,
    page,
    setPage,
    selected,
    setSelected,
    modal,
    setModal,
    users,
    clients,
    cases,
    alerts,
    dashboard,
    audit,
    report,
    editUser,
    setEditUser,
    editClient,
    newCaseClientId,
    clientSearch,
    setClientSearch,
    clientFilter,
    setClientFilter,
    search,
    setSearch,
    area,
    setArea,
    status,
    setStatus,
    error,
    setError,
    busy,
    isAdmin,
    logout,
    load,
    openCase,
    done,
    clearFilters,
    viewClientCases,
    newCase,
    createClient,
    correctClient,
  };
}
export type LexioState = ReturnType<typeof useLexio>;
