import { useEffect, useState } from "react";
import { api, dateLabel, localDate, money, query } from "./api";
import { Badge, Card, Empty, Field } from "./components";
import type {
  Case,
  Client,
  Collections,
  Economic,
  Operational,
  Service,
  User,
} from "./types";

export default function Reports({
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
    void Promise.all([api<Client[]>("/clients"), api<Case[]>("/cases")])
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
    void api<Service[]>(`/cases/${filters.case_id}/services`)
      .then(setServices)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"));
  }, [filters.case_id]);
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
  const userName = (id: number) =>
    users.find((x) => x.id === id)?.name || `Usuario ${id}`;
  async function load() {
    setBusy(true);
    setError("");
    try {
      if (tab === "operativo")
        setOperational(
          await api<Operational>(
            `/reports/operational?${query({ area: filters.area, responsible_id: filters.responsible_id, status: filters.status, client_id: filters.client_id, start: filters.start, end: filters.end, date_basis: filters.date_basis })}`,
          ),
        );
      else if (tab === "cobros") {
        if (!filters.start || !filters.end)
          throw new Error("Selecciona inicio y fin del periodo de abonos");
        setCollections(
          await api<Collections>(
            `/reports/collections?${query({ start: filters.start, end: filters.end, client_id: filters.client_id, case_id: filters.case_id, service_id: filters.service_id, area: filters.area })}`,
          ),
        );
      } else
        setEconomic(
          await api<Economic>(
            `/reports/economic?${query({ cutoff: filters.cutoff, client_id: filters.client_id, case_id: filters.case_id, service_id: filters.service_id, area: filters.area })}`,
          ),
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }
  const input = (key: keyof typeof filters, label: string, type = "text") => (
    <Field label={label}>
      <input
        type={type}
        value={filters[key]}
        onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}
      />
    </Field>
  );
  const caseRows = (list: Case[]) => (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente / documento</th>
            <th>Caso</th>
            <th>Materia / etapa</th>
            <th>Responsable</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id}>
              <td>
                {x.client.name}
                <small>{x.client.code}</small>
              </td>
              <td>
                <button className="link-button" onClick={() => openCase(x.id)}>
                  {x.code}
                </button>
              </td>
              <td>
                {x.subject}
                <small>{x.current_stage}</small>
              </td>
              <td>{userName(x.responsible_id)}</td>
              <td>
                <Badge>{x.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Información acumulada</p>
          <h1>Consola de reportes</h1>
          <p>Consulta las fuentes y abre el caso desde cada fila.</p>
        </div>
      </div>
      <div className="tabs">
        {[
          ["operativo", "Operativos"],
          ...(actor.role === "admin"
            ? [
                ["economico", "Gerencial por área"],
                ["cuenta", "Estado de cuenta y cartera"],
                ["cobros", "Cobros por periodo"],
              ]
            : []),
        ].map(([k, l]) => (
          <button
            key={k}
            className={tab === k ? "active" : ""}
            onClick={() => setTab(k)}
          >
            {l}
          </button>
        ))}
      </div>
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
          <button
            disabled={busy}
            className="primary"
            onClick={() => void load()}
          >
            {busy ? "Consultando…" : "Consultar"}
          </button>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </Card>
      {tab === "operativo" && operational && (
        <>
          <Card>
            <h2>Casos únicos por rama</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Área</th>
                    <th>Total</th>
                    <th>Activos</th>
                    <th>Concluidos</th>
                    <th>Suspendidos</th>
                  </tr>
                </thead>
                <tbody>
                  {operational.areas.map((x) => (
                    <tr key={x.area}>
                      <td>{x.area}</td>
                      {(
                        ["total", "activo", "concluido", "suspendido"] as const
                      ).map((k) => (
                        <td key={k}>
                          <button
                            className="link-button"
                            onClick={() => {
                              setDetailFilter({
                                area: x.area,
                                status: k === "total" ? "" : k,
                              });
                              document
                                .getElementById(`area-${x.area}`)
                                ?.scrollIntoView({ behavior: "smooth" });
                            }}
                          >
                            {x[k]}
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr>
                    <td>TOTAL</td>
                    {(
                      ["total", "activo", "concluido", "suspendido"] as const
                    ).map((k) => (
                      <td key={k}>
                        {operational.areas.reduce((s, x) => s + x[k], 0)}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
          {operational.areas.map((x) => (
            <Card key={x.area}>
              <div id={`area-${x.area}`}>
                <h2>
                  {x.area} · detalle de casos{" "}
                  {detailFilter?.area === x.area && detailFilter.status
                    ? `· ${detailFilter.status}`
                    : ""}
                </h2>
                {caseRows(
                  operational.cases.filter(
                    (c) =>
                      c.area === x.area &&
                      (!detailFilter ||
                        detailFilter.area !== x.area ||
                        !detailFilter.status ||
                        c.status === detailFilter.status),
                  ),
                )}
              </div>
            </Card>
          ))}
          <Card>
            <h2>Actuaciones</h2>
            {!operational.entries.length ? (
              <Empty />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente / caso</th>
                      <th>Actuación</th>
                      <th>Fecha real</th>
                      <th>Registrador</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operational.entries.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <button
                            className="link-button"
                            onClick={() => openCase(x.case_id)}
                          >
                            {x.case_code}
                          </button>
                          <small>
                            {x.client?.name} · {x.client?.code}
                          </small>
                        </td>
                        <td>{x.description}</td>
                        <td>{dateLabel(x.action_date)}</td>
                        <td>{userName(x.registered_by)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <Card>
            <h2>Vencimientos y atención</h2>
            {!operational.tasks.length ? (
              <Empty />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente / caso</th>
                      <th>Tarea</th>
                      <th>Responsable</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {operational.tasks.map((x) => (
                      <tr key={x.id}>
                        <td>
                          <button
                            className="link-button"
                            onClick={() => openCase(x.case_id)}
                          >
                            {x.case_code}
                          </button>
                          <small>{x.client?.name}</small>
                        </td>
                        <td>{x.description}</td>
                        <td>{userName(x.responsible_id)}</td>
                        <td>{dateLabel(x.due_date)}</td>
                        <td>
                          <Badge>{x.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
      {(tab === "economico" || tab === "cuenta") && economic && (
        <>
          <p className="notice">
            Corte: {dateLabel(economic.cutoff)}. Se usan los registros vigentes,
            las contrataciones y abonos hasta el corte. Las condiciones de
            eventos y reversiones reflejan su revisión actual.
          </p>
          <div className="stats">
            {(
              [
                ["contracted", "Contratado"],
                ["applied", "Cobrado aplicado"],
                ["balance", "Saldo por cobrar"],
                ["overdue", "Vencido"],
                ["not_due", "No vencido"],
                ["pending_event", "Pendiente de evento"],
                ["credit", "Crédito sin aplicar"],
              ] as const
            ).map(([k, l]) => (
              <Card className="stat" key={k}>
                <p>{l}</p>
                <strong className="!text-xl">
                  {money(economic.totals[k])}
                </strong>
              </Card>
            ))}
          </div>
          {tab === "economico" && (
            <Card>
              <h2>Vista gerencial por rama</h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Área</th>
                      <th>Casos</th>
                      <th>Activos</th>
                      <th>Concluidos</th>
                      <th>Suspendidos</th>
                      <th>Contratado</th>
                      <th>Cobrado aplicado</th>
                      <th>Saldo</th>
                      <th>Vencido</th>
                      <th>No vencido</th>
                      <th>Pend. evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {economic.areas.map((x) => (
                      <tr key={x.area}>
                        <td>{x.area}</td>
                        <td>{x.total}</td>
                        <td>{x.activo}</td>
                        <td>{x.concluido}</td>
                        <td>{x.suspendido}</td>
                        {(
                          [
                            "contracted",
                            "applied",
                            "balance",
                            "overdue",
                            "not_due",
                            "pending_event",
                          ] as const
                        ).map((k) => (
                          <td key={k}>{money(x[k])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {economic.services.map((s) => (
            <Card key={s.id}>
              <div className="card-head">
                <div>
                  <h2>
                    {s.client?.name} · {s.scope}
                  </h2>
                  <small>
                    {s.client?.code} · Servicio {s.id} · {money(s.fee)}
                  </small>
                </div>
                <button
                  className="link-button"
                  onClick={() => openCase(s.case_id)}
                >
                  {s.case_code}
                </button>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cuota / condición</th>
                      <th>Vencimiento</th>
                      <th>Monto</th>
                      <th>Abonado</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.installments?.map((x) => (
                      <tr key={x.id}>
                        <td>
                          Cuota {x.number}
                          <small>
                            {x.condition}{" "}
                            {x.event_id ? `· evento ${x.event_id}` : ""}
                          </small>
                          {x.payments.map((p) => (
                            <small key={p.id}>
                              {dateLabel(p.payment_date)} ·{" "}
                              {money(p.applied_amount)}{" "}
                              {p.reversed_at ? "· reversado" : ""}
                            </small>
                          ))}
                        </td>
                        <td>{dateLabel(x.due_date)}</td>
                        <td>{money(x.amount)}</td>
                        <td>{money(x.paid)}</td>
                        <td>{money(x.balance)}</td>
                        <td>
                          <Badge>{x.state}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ))}
        </>
      )}
      {tab === "cobros" && collections && (
        <>
          <Card>
            <h2>
              Recibido: {money(collections.received)} · crédito sin aplicar:{" "}
              {money(collections.credit)}
            </h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Cliente / caso</th>
                    <th>Servicio</th>
                    <th>Recibido</th>
                    <th>Aplicación</th>
                    <th>Crédito</th>
                    <th>Medio</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.payments.map((x) => (
                    <tr key={x.id}>
                      <td>{dateLabel(x.payment_date)}</td>
                      <td>
                        <button
                          className="link-button"
                          onClick={() => x.case_id && openCase(x.case_id)}
                        >
                          {x.case_code}
                        </button>
                        <small>{x.client?.name}</small>
                      </td>
                      <td>{x.service_id}</td>
                      <td>
                        {money(x.amount)}
                        {x.reversed_at && <small>Reversado</small>}
                      </td>
                      <td>
                        {x.applications?.map((a) => (
                          <small key={a.installment_id}>
                            Cuota ID {a.installment_id}: {money(a.amount)}
                          </small>
                        ))}
                      </td>
                      <td>{money(x.credit)}</td>
                      <td>{x.method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  );
}
