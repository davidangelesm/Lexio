import { useEffect, useState } from "react";
import { administrationService } from "../services/administration";
import { alertsService } from "../services/alerts";
import { casesService } from "../services/cases";
import { clientsService } from "../services/clients";
import { dashboardService } from "../services/dashboard";
import { setToken } from "../services/http";
import type {
  Alert,
  Audit,
  Case,
  Client,
  Dashboard,
  User,
} from "../types/index";

export function useLexio() {
  const [actor, setActor] = useState<User>();
  const [page, setPage] = useState("panel");
  const [selected, setSelected] = useState<Case>();
  const [modal, setModal] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState("");
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [newCaseClient, setNewCaseClient] = useState<Client>();
  const [editClient, setEditClient] = useState<Client>();
  const [editUser, setEditUser] = useState<User>();
  const [fileClient, setFileClient] = useState<Client>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [noticeDays, setNoticeDays] = useState<number[]>([3, 1]);
  const isAdmin = actor?.role === "admin";
  function logout() {
    setToken("");
    setActor(undefined);
    setSelected(undefined);
    setDashboard(undefined);
    setClients([]);
    setCases([]);
    setUsers([]);
    setAlerts([]);
    setAudit([]);
    setPage("panel");
  }
  useEffect(() => {
    window.addEventListener("lexio-session-expired", logout);
    return () => window.removeEventListener("lexio-session-expired", logout);
  }, []);
  async function load() {
    if (!actor) return;
    setBusy(true);
    setError("");
    try {
      const list = await administrationService.listUsers();
      setUsers(list);
      if (page === "panel") setDashboard(await dashboardService.list());
      if (page === "clientes")
        setClients(
          await clientsService.list({ q: search, document_type: docType }),
        );
      if (page === "casos")
        setCases(
          await casesService.list({ area, status, client_id: clientFilter }),
        );
      if (page === "alertas") setAlerts(await alertsService.list());
      if (page === "usuarios") {
        setAudit(await administrationService.listAudit());
        setNoticeDays((await administrationService.getNoticeSettings()).days);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo conectar con la API",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (actor) void load();
  }, [actor?.id, page]);
  useEffect(() => {
    if (!actor || (page !== "panel" && page !== "alertas") || selected) return;
    const timer = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(timer);
  }, [actor?.id, page, selected]);
  async function openCase(id: number) {
    setBusy(true);
    setError("");
    try {
      setSelected(await casesService.get(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  async function done() {
    setModal("");
    await load();
  }
  const userName = (id: number) =>
    users.find((x) => x.id === id)?.name || `Usuario ${id}`;
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
    setUsers,
    clients,
    setClients,
    cases,
    setCases,
    dashboard,
    setDashboard,
    alerts,
    setAlerts,
    audit,
    setAudit,
    search,
    setSearch,
    docType,
    setDocType,
    area,
    setArea,
    status,
    setStatus,
    clientFilter,
    setClientFilter,
    newCaseClient,
    setNewCaseClient,
    editClient,
    setEditClient,
    editUser,
    setEditUser,
    fileClient,
    setFileClient,
    error,
    setError,
    busy,
    setBusy,
    noticeDays,
    setNoticeDays,
    isAdmin,
    logout,
    load,
    openCase,
    done,
    userName,
  };
}
export type LexioState = ReturnType<typeof useLexio>;
