import { useEffect, useState } from "react";
import { casesService } from "../../../services/cases";
import { clientsService } from "../../../services/clients";
import { reportsService } from "../../../services/reports";
import type {
  Case,
  Client,
  Collections,
  Economic,
  Operational,
  Service,
  User,
} from "../../../types/index";
import { localDate } from "../../../utils/format";

export function useReports({
  actor,
  users,
  openCase,
}: {
  actor: User;
  users: User[];
  openCase: (id: number) => void;
}) {
  const [detailFilter, setDetailFilter] = useState<{
    area: string;
    status: string;
  }>();
  const [clients, setClients] = useState<Client[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [tab, setTab] = useState("operativo");
  const [filters, setFilters] = useState({
    area: "",
    responsible_id: "",
    status: "",
    client_id: "",
    case_id: "",
    service_id: "",
    start: "",
    end: "",
    date_basis: "inicio",
    cutoff: localDate(),
  });
  const [operational, setOperational] = useState<Operational>();
  const [economic, setEconomic] = useState<Economic>();
  const [collections, setCollections] = useState<Collections>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void Promise.all([clientsService.list(), casesService.list()])
      .then(([c, k]) => {
        setClients(c);
        setCases(k);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, []);
  useEffect(() => {
    if (!filters.case_id) {
      setServices([]);
      return;
    }
    void casesService
      .listServices(filters.case_id)
      .then(setServices)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [filters.case_id]);
  const userName = (id: number) =>
    users.find((x) => x.id === id)?.name || `Usuario ${id}`;
  async function load() {
    setBusy(true);
    setError("");
    try {
      if (tab === "operativo")
        setOperational(
          await reportsService.operational({
            area: filters.area,
            responsible_id: filters.responsible_id,
            status: filters.status,
            client_id: filters.client_id,
            start: filters.start,
            end: filters.end,
            date_basis: filters.date_basis,
          }),
        );
      else if (tab === "cobros") {
        if (!filters.start || !filters.end)
          throw new Error("Selecciona inicio y fin del periodo de abonos");
        setCollections(
          await reportsService.collections({
            start: filters.start,
            end: filters.end,
            client_id: filters.client_id,
            case_id: filters.case_id,
            service_id: filters.service_id,
            area: filters.area,
          }),
        );
      } else
        setEconomic(
          await reportsService.economic({
            cutoff: filters.cutoff,
            client_id: filters.client_id,
            case_id: filters.case_id,
            service_id: filters.service_id,
            area: filters.area,
          }),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  return {
    detailFilter,
    setDetailFilter,
    clients,
    setClients,
    cases,
    setCases,
    services,
    setServices,
    tab,
    setTab,
    filters,
    setFilters,
    operational,
    setOperational,
    economic,
    setEconomic,
    collections,
    setCollections,
    error,
    setError,
    busy,
    setBusy,
    userName,
    load,
    actor,
    users,
    openCase,
  };
}
export type ReportsState = ReturnType<typeof useReports>;
