import { Card, Field } from "../../../components/ui";
import type { ReportsState } from "../hooks/useReports";

type Props = Pick<
  ReportsState,
  | "filters"
  | "setFilters"
  | "clients"
  | "cases"
  | "services"
  | "tab"
  | "users"
  | "busy"
  | "load"
  | "error"
>;
export default function ReportFilters({
  filters,
  setFilters,
  clients,
  cases,
  services,
  tab,
  users,
  busy,
  load,
  error,
}: Props) {
  const selectClient = (
    <Field label="Cliente / documento">
      <select
        value={filters.client_id}
        onChange={(e) =>
          setFilters({
            ...filters,
            client_id: e.target.value,
            case_id: "",
            service_id: "",
          })
        }
      >
        <option value="">Todos los clientes</option>
        {clients.map((x) => (
          <option key={x.id} value={x.id}>
            {x.code} · {x.name}
          </option>
        ))}
      </select>
    </Field>
  );
  const selectCase = (
    <Field label="Caso">
      <select
        value={filters.case_id}
        onChange={(e) =>
          setFilters({ ...filters, case_id: e.target.value, service_id: "" })
        }
      >
        <option value="">Todos los casos del cliente</option>
        {cases
          .filter(
            (x) =>
              !filters.client_id || String(x.client_id) === filters.client_id,
          )
          .map((x) => (
            <option key={x.id} value={x.id}>
              {x.code} · {x.subject}
            </option>
          ))}
      </select>
    </Field>
  );
  const selectService = (
    <Field label="Servicio">
      <select
        value={filters.service_id}
        onChange={(e) => setFilters({ ...filters, service_id: e.target.value })}
      >
        <option value="">Todos los servicios</option>
        {services.map((x) => (
          <option key={x.id} value={x.id}>
            {x.id} · {x.scope}
          </option>
        ))}
      </select>
    </Field>
  );
  const input = (key: keyof typeof filters, label: string, type = "text") => (
    <Field label={label}>
      <input
        type={type}
        value={filters[key]}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
      />
    </Field>
  );
  return (
    <Card>
      <div className="filters">
        {input("area", "Rama / área")}
        {selectClient}
        {tab === "operativo" ? (
          <>
            <Field label="Responsable">
              <select
                value={filters.responsible_id}
                onChange={(e) =>
                  setFilters({ ...filters, responsible_id: e.target.value })
                }
              >
                <option value="">Todos</option>
                {users.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado del caso">
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                <option value="">Todos</option>
                {["activo", "suspendido", "concluido"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </Field>
            <Field label="Filtrar fechas de">
              <select
                value={filters.date_basis}
                onChange={(e) =>
                  setFilters({ ...filters, date_basis: e.target.value })
                }
              >
                <option value="inicio">Inicio del caso</option>
                <option value="actuacion">Actuación</option>
                <option value="vencimiento">Vencimiento</option>
              </select>
            </Field>
          </>
        ) : (
          <>
            {selectCase}
            {selectService}
            {tab !== "cobros" && input("cutoff", "Fecha de corte", "date")}
          </>
        )}
        {(tab === "operativo" || tab === "cobros") && (
          <>
            {input(
              "start",
              tab === "cobros" ? "Abonos desde" : "Desde",
              "date",
            )}
            {input("end", "Hasta", "date")}
          </>
        )}
        <button disabled={busy} className="primary" onClick={() => void load()}>
          {busy ? "Consultando…" : "Consultar"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
