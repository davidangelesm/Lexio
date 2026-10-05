import { useEffect, useState } from "react";
import {
  Scale,
  LayoutDashboard,
  Users,
  FolderOpen,
  Bell,
  ChartNoAxesCombined,
  ShieldCheck,
  LogOut,
  Plus,
  ArrowUpRight,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { api, dateLabel, localDate, money, query, setToken } from "./api";
import { Badge, Card, Empty, Field, Form, Modal, num, str } from "./components";
import CaseWorkspace from "./CaseWorkspace";
import Reports from "./Reports";
import ClientFiles from "./ClientFiles";
import type { Alert, Audit, Case, Client, Dashboard, User } from "./types";
import "./styles.css";

export default function Lexio() {
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
      const list = await api<User[]>("/users");
      setUsers(list);
      if (page === "panel") setDashboard(await api<Dashboard>("/dashboard"));
      if (page === "clientes")
        setClients(
          await api<Client[]>(
            `/clients?${query({ q: search, document_type: docType })}`,
          ),
        );
      if (page === "casos")
        setCases(
          await api<Case[]>(
            `/cases?${query({ area, status, client_id: clientFilter })}`,
          ),
        );
      if (page === "alertas") setAlerts(await api<Alert[]>("/alerts"));
      if (page === "usuarios") {
        setAudit(await api<Audit[]>("/audit"));
        setNoticeDays(
          (await api<{ days: number[] }>("/settings/notices")).days,
        );
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
      setSelected(await api<Case>(`/cases/${id}`));
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
  const alertTable = (data: Alert[]) =>
    !data.length ? (
      <Empty text="No hay alertas actuales para tus casos autorizados." />
    ) : (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Cliente / caso</th>
              <th>Obligación</th>
              <th>Fecha objetivo</th>
              <th>Responsable</th>
              {isAdmin && <th>Saldo</th>}
              <th>Aviso</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.map((x) => (
              <tr key={x.id}>
                <td>
                  <button
                    className="link-button"
                    onClick={() => void openCase(x.case_id)}
                  >
                    {x.client.name}
                  </button>
                  <small>
                    {x.client.code} · {x.case_code}
                  </small>
                </td>
                <td>
                  {x.description}
                  <small>{x.kind}</small>
                </td>
                <td>{dateLabel(x.target_date)}</td>
                <td>{userName(x.responsible_id)}</td>
                {isAdmin && <td>{x.amount ? money(x.amount) : "—"}</td>}
                <td>
                  <Badge>{x.label}</Badge>
                  {x.read_at && <small>Leído</small>}
                </td>
                <td>
                  <button
                    className="link-button"
                    disabled={busy}
                    onClick={async () => {
                      setError("");
                      try {
                        await api(`/alerts/${x.id}/read`, "POST");
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Error");
                      }
                    }}
                  >
                    Leer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  if (!actor)
    return (
      <main className="login">
        <section className="login-brand">
          <div className="brand">
            <Scale size={36} />
            <span>
              Lexio<small>LEXCONTERRA GROUP</small>
            </span>
          </div>
          <p className="eyebrow">Control jurídico y gerencial</p>
          <h1>
            Tu estudio.
            <br />
            Cada caso, en orden.
          </h1>
          <p>
            Historia, vencimientos y gestión del estudio en un espacio de
            trabajo seguro.
          </p>
        </section>
        <section className="login-form">
          <div>
            <p className="eyebrow">Bienvenido a Lexio</p>
            <h2>Ingresa a tu estudio</h2>
            <p className="muted text-sm mb-8">
              Usa tu correo y contraseña individual.
            </p>
            <Form
              label="Ingresar"
              submit={async (f) => {
                const result = await api<{ access_token: string; user: User }>(
                  "/auth/login",
                  "POST",
                  { email: str(f, "email"), password: str(f, "password") },
                );
                setToken(result.access_token);
                setActor(result.user);
              }}
            >
              <Field label="Correo">
                <input
                  type="email"
                  name="email"
                  autoComplete="username"
                  required
                  placeholder="tu@estudio.pe"
                />
              </Field>
              <Field label="Contraseña">
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
            </Form>
            <p className="text-xs muted mt-8">
              El administrador crea tu cuenta y autoriza tus casos.
            </p>
          </div>
        </section>
      </main>
    );
  const navigation = [
    { key: "panel", label: "Panel del día", Icon: LayoutDashboard },
    { key: "clientes", label: "Clientes", Icon: Users },
    { key: "casos", label: "Casos", Icon: FolderOpen },
    { key: "alertas", label: "Centro de alertas", Icon: Bell },
    { key: "reportes", label: "Reportes", Icon: ChartNoAxesCombined },
    ...(isAdmin
      ? [{ key: "usuarios", label: "Administración", Icon: ShieldCheck }]
      : []),
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Scale size={30} />
          <span>
            Lexio<small>CONTROL JURÍDICO</small>
          </span>
        </div>
        <p className="eyebrow px-3 mb-4">Espacio de trabajo</p>
        <nav>
          {navigation.map(({ key, label, Icon }) => (
            <button
              title={label}
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => {
                setSelected(undefined);
                setPage(key);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="profile">
          <strong>{actor.name}</strong>
          <small>
            {isAdmin ? "Administrador · finanzas" : "Equipo jurídico"}
          </small>
          <button onClick={logout}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            LEXCONTERRA GROUP /{" "}
            {selected?.code || navigation.find((x) => x.key === page)?.label}
          </span>
          <div className="flex items-center gap-3">
            <CalendarDays size={15} />
            {dateLabel(localDate())}
            <span className="badge">
              {isAdmin ? "Administración" : "Acceso autorizado"}
            </span>
          </div>
        </header>
        <main className="content">
          {selected ? (
            <CaseWorkspace
              key={selected.id}
              selected={selected}
              actor={actor}
              users={users}
              back={() => {
                setSelected(undefined);
                void load();
              }}
            />
          ) : (
            <>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {page === "panel" && (
                <>
                  <div className="page-head">
                    <div>
                      <p className="eyebrow">Tu jornada en perspectiva</p>
                      <h1>Panel del día</h1>
                      <p>
                        Hola, {actor.name.split(" ")[0]}. Estas son las
                        prioridades de tu estudio.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void load()}
                    >
                      <RefreshCw
                        size={14}
                        className={busy ? "animate-spin" : ""}
                      />
                      Actualizar
                    </button>
                  </div>
                  {dashboard ? (
                    <>
                      <div className="stats">
                        <Card className="stat">
                          <FolderOpen size={20} />
                          <p>Casos activos</p>
                          <strong>{dashboard.active_cases}</strong>
                          <small>Cartera autorizada</small>
                        </Card>
                        <Card className="stat">
                          <Bell size={20} />
                          <p>Avisos procesales</p>
                          <strong>{dashboard.procedural_alerts}</strong>
                          <small>Próximos, hoy y vencidos</small>
                        </Card>
                        <Card className="stat">
                          <CalendarDays size={20} />
                          <p>Programado para hoy</p>
                          <strong>
                            {dashboard.today_tasks.length +
                              (dashboard.today_events?.length || 0)}
                          </strong>
                          <small>Tareas pendientes</small>
                        </Card>
                        {isAdmin && (
                          <Card className="stat">
                            <ChartNoAxesCombined size={20} />
                            <p>Avisos de pago</p>
                            <strong>{dashboard.payment_alerts || 0}</strong>
                            <small>
                              {money(dashboard.payment_balance)} · incluye
                              provisionales
                            </small>
                          </Card>
                        )}
                      </div>
                      <Card>
                        <div className="card-head">
                          <h2>Prioridades y vencimientos</h2>
                          <button
                            className="link-button flex gap-2 items-center"
                            onClick={() => setPage("alertas")}
                          >
                            Ver centro de alertas
                            <ArrowUpRight size={15} />
                          </button>
                        </div>
                        {alertTable(dashboard.alerts)}
                      </Card>
                      <Card>
                        <h2>Actuaciones programadas para hoy</h2>
                        {!dashboard.today_tasks.length &&
                        !dashboard.today_events?.length ? (
                          <Empty text="No tienes tareas ni eventos programados para hoy." />
                        ) : (
                          dashboard.today_tasks.map((x) => (
                            <div
                              key={x.id}
                              className="flex justify-between text-sm py-3"
                            >
                              <span>
                                {x.description} · {userName(x.responsible_id)}
                              </span>
                              <button
                                className="link-button"
                                onClick={() => void openCase(x.case_id)}
                              >
                                Abrir caso
                              </button>
                            </div>
                          ))
                        )}
                        {dashboard.today_events?.map((x) => (
                          <div
                            key={`event-${x.id}`}
                            className="flex justify-between text-sm py-3"
                          >
                            <span>{x.description} · evento programado</span>
                            <button
                              className="link-button"
                              onClick={() => void openCase(x.case_id)}
                            >
                              Abrir caso
                            </button>
                          </div>
                        ))}
                      </Card>
                      {isAdmin && (
                        <Card>
                          <h2>Eventos de cobro por revisar</h2>
                          {!dashboard.event_reviews?.length ? (
                            <Empty text="Las cuotas vinculadas a eventos no requieren revisión." />
                          ) : (
                            dashboard.event_reviews.map((x) => (
                              <div
                                key={x.installment_id}
                                className="flex justify-between py-3 text-sm"
                              >
                                <span>{x.description}</span>
                                <button
                                  className="link-button"
                                  onClick={() => void openCase(x.case_id)}
                                >
                                  Revisar en finanzas
                                </button>
                              </div>
                            ))
                          )}
                        </Card>
                      )}
                    </>
                  ) : (
                    <Empty
                      text={
                        busy
                          ? "Cargando el panel…"
                          : "Conecta la API y actualiza el panel."
                      }
                    />
                  )}
                </>
              )}
              {page === "clientes" && (
                <>
                  <div className="page-head">
                    <div>
                      <p className="eyebrow">Identificación por documento</p>
                      <h1>Clientes</h1>
                      <p>
                        Datos estables para todos los casos de cada cliente.
                      </p>
                    </div>
                    {(isAdmin || actor.can_create_clients) && (
                      <button
                        className="primary"
                        onClick={() => {
                          setEditClient(undefined);
                          setModal("cliente");
                        }}
                      >
                        <Plus size={15} />
                        Registrar cliente
                      </button>
                    )}
                  </div>
                  <Card>
                    <form
                      className="filters"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void load();
                      }}
                    >
                      <Field label="Tipo de documento">
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value)}
                        >
                          <option value="">Todos</option>
                          {["DNI", "RUC", "CE"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Documento o nombre">
                        <input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Conserva los ceros iniciales"
                        />
                      </Field>
                      <button className="primary" disabled={busy}>
                        Buscar
                      </button>
                    </form>
                    {!clients.length ? (
                      <Empty
                        text={
                          busy
                            ? "Buscando…"
                            : "Sin clientes visibles. Solicita autorización si el cliente ya está registrado."
                        }
                      />
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Documento</th>
                              <th>Cliente</th>
                              <th>Contacto</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {clients.map((x) => (
                              <tr key={x.id}>
                                <td>
                                  {x.code}
                                  <small>ID {x.id}</small>
                                </td>
                                <td>{x.name}</td>
                                <td>
                                  {x.phone || "—"}
                                  <small>{x.email}</small>
                                </td>
                                <td>
                                  <div className="actions">
                                    <button
                                      className="link-button"
                                      onClick={() => {
                                        setClientFilter(String(x.id));
                                        setPage("casos");
                                      }}
                                    >
                                      Ver casos
                                    </button>
                                    <button
                                      className="link-button"
                                      onClick={() => {
                                        setFileClient(x);
                                        setModal("documentos");
                                      }}
                                    >
                                      Documentos
                                    </button>
                                    {(isAdmin || actor.can_create_cases) && (
                                      <button
                                        className="link-button"
                                        onClick={() => {
                                          setNewCaseClient(x);
                                          setModal("caso");
                                        }}
                                      >
                                        Nuevo caso
                                      </button>
                                    )}
                                    {isAdmin && (
                                      <button
                                        className="link-button"
                                        onClick={() => {
                                          setEditClient(x);
                                          setModal("cliente");
                                        }}
                                      >
                                        Corregir datos
                                      </button>
                                    )}
                                  </div>
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
              {page === "casos" && (
                <>
                  <div className="page-head">
                    <div>
                      <p className="eyebrow">Cartera jurídica</p>
                      <h1>Casos</h1>
                      <p>
                        Selecciona un caso para consultar su historia y módulos.
                      </p>
                    </div>
                    {(isAdmin || actor.can_create_cases) && (
                      <button
                        className="primary"
                        onClick={() => setPage("clientes")}
                      >
                        <Plus size={15} />
                        Seleccionar cliente
                      </button>
                    )}
                  </div>
                  <Card>
                    <form
                      className="filters"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void load();
                      }}
                    >
                      <Field label="Rama / área">
                        <input
                          value={area}
                          onChange={(e) => setArea(e.target.value)}
                        />
                      </Field>
                      <Field label="Estado">
                        <select
                          value={status}
                          onChange={(e) => setStatus(e.target.value)}
                        >
                          <option value="">Todos</option>
                          {["activo", "suspendido", "concluido"].map((x) => (
                            <option key={x}>{x}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="ID cliente">
                        <input
                          type="number"
                          value={clientFilter}
                          onChange={(e) => setClientFilter(e.target.value)}
                        />
                      </Field>
                      <button className="primary" disabled={busy}>
                        Filtrar
                      </button>
                    </form>
                    {!cases.length ? (
                      <Empty
                        text={
                          busy
                            ? "Consultando…"
                            : "No hay casos autorizados con estos filtros."
                        }
                      />
                    ) : (
                      <div className="table-wrap">
                        <table>
                          <thead>
                            <tr>
                              <th>Caso / cliente</th>
                              <th>Rama y materia</th>
                              <th>Etapa</th>
                              <th>Responsable</th>
                              <th>Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cases.map((x) => (
                              <tr key={x.id}>
                                <td>
                                  <button
                                    className="link-button"
                                    onClick={() => void openCase(x.id)}
                                  >
                                    {x.code} · {x.client.name}
                                  </button>
                                  <small>{x.client.code}</small>
                                </td>
                                <td>
                                  {x.area}
                                  <small>{x.subject}</small>
                                </td>
                                <td>{x.current_stage}</td>
                                <td>{userName(x.responsible_id)}</td>
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
              {page === "alertas" && (
                <>
                  <div className="page-head">
                    <div>
                      <p className="eyebrow">Seguimiento del estudio</p>
                      <h1>Centro de alertas</h1>
                      <p>
                        Leer un aviso no resuelve la tarea ni cancela la deuda.
                      </p>
                    </div>
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => void load()}
                    >
                      <RefreshCw size={14} />
                      Actualizar
                    </button>
                  </div>
                  <Card>{alertTable(alerts)}</Card>
                </>
              )}
              {page === "reportes" && (
                <Reports
                  actor={actor}
                  users={users}
                  openCase={(id) => void openCase(id)}
                />
              )}
              {page === "usuarios" && isAdmin && (
                <>
                  <div className="page-head">
                    <div>
                      <p className="eyebrow">Permisos y trazabilidad</p>
                      <h1>Administración</h1>
                      <p>
                        El acceso financiero pertenece exclusivamente a tu
                        cuenta administradora.
                      </p>
                    </div>
                    <button
                      className="primary"
                      onClick={() => {
                        setEditUser(undefined);
                        setModal("usuario");
                      }}
                    >
                      <Plus size={15} />
                      Crear usuario
                    </button>
                  </div>
                  <Card>
                    <h2>Usuarios del estudio</h2>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Nombre / correo</th>
                            <th>Rol</th>
                            <th>Crear clientes</th>
                            <th>Crear casos</th>
                            <th>Estado</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {users.map((x) => (
                            <tr key={x.id}>
                              <td>
                                {x.name}
                                <small>{x.email}</small>
                              </td>
                              <td>{x.role}</td>
                              <td>{x.can_create_clients ? "Sí" : "No"}</td>
                              <td>{x.can_create_cases ? "Sí" : "No"}</td>
                              <td>{x.active ? "Activo" : "Inactivo"}</td>
                              <td>
                                {x.role !== "admin" && (
                                  <button
                                    className="link-button"
                                    onClick={() => {
                                      setEditUser(x);
                                      setModal("usuario");
                                    }}
                                  >
                                    Editar permisos
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                  <Card>
                    <h2>Anticipación de avisos</h2>
                    <Form
                      submit={async (f) => {
                        await api("/settings/notices", "PUT", {
                          days: [num(f, "first"), num(f, "second")],
                        });
                        await load();
                      }}
                    >
                      <Field label="Primer aviso (lunes a viernes)">
                        <input
                          name="first"
                          type="number"
                          min="1"
                          max="60"
                          defaultValue={noticeDays[0]}
                          required
                        />
                      </Field>
                      <Field label="Segundo aviso">
                        <input
                          name="second"
                          type="number"
                          min="1"
                          max="60"
                          defaultValue={noticeDays[1]}
                          required
                        />
                      </Field>
                    </Form>
                  </Card>
                  <Card>
                    <h2>Últimos cambios</h2>
                    <div className="table-wrap">
                      <table>
                        <thead>
                          <tr>
                            <th>Registro UTC</th>
                            <th>Usuario</th>
                            <th>Acción</th>
                            <th>Recurso</th>
                            <th>Cambio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {audit.map((x) => (
                            <tr key={x.id}>
                              <td>{x.created_at}</td>
                              <td>{userName(x.user_id)}</td>
                              <td>{x.action}</td>
                              <td>
                                {x.resource} #{x.resource_id}
                              </td>
                              <td>
                                <details>
                                  <summary>Ver cambio</summary>
                                  <pre className="text-xs max-w-96 overflow-auto">
                                    {x.changes}
                                  </pre>
                                </details>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
          {modal && (
            <Modal
              title={
                modal === "cliente"
                  ? "Ficha del cliente"
                  : modal === "caso"
                    ? "Crear caso"
                    : modal === "documentos"
                      ? "Documentos del cliente"
                      : "Cuenta del equipo"
              }
              close={() => setModal("")}
            >
              {modal === "documentos" && fileClient && (
                <ClientFiles client={fileClient} isAdmin={!!isAdmin} />
              )}
              {modal === "cliente" && (
                <Form
                  submit={async (f) => {
                    const result = await api<Client>(
                      editClient ? `/clients/${editClient.id}` : "/clients",
                      editClient ? "PUT" : "POST",
                      {
                        document_type: str(f, "document_type"),
                        document_number: str(f, "document_number"),
                        name: str(f, "name"),
                        phone: str(f, "phone"),
                        email: str(f, "email"),
                        address: str(f, "address"),
                      },
                    );
                    if (!editClient && (isAdmin || actor.can_create_cases)) {
                      setNewCaseClient(result);
                      setModal("caso");
                    } else await done();
                  }}
                >
                  <Field label="Tipo de documento">
                    <select
                      name="document_type"
                      defaultValue={editClient?.document_type || "DNI"}
                    >
                      {["DNI", "RUC", "CE"].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Número como texto">
                    <input
                      name="document_number"
                      required
                      maxLength={20}
                      defaultValue={editClient?.document_number}
                    />
                  </Field>
                  <div className="full">
                    <Field label="Nombres y apellidos / razón social">
                      <input
                        name="name"
                        required
                        defaultValue={editClient?.name}
                      />
                    </Field>
                  </div>
                  <Field label="Celular">
                    <input name="phone" defaultValue={editClient?.phone} />
                  </Field>
                  <Field label="Correo">
                    <input
                      name="email"
                      type="email"
                      defaultValue={editClient?.email}
                    />
                  </Field>
                  <div className="full">
                    <Field label="Dirección">
                      <input
                        name="address"
                        defaultValue={editClient?.address}
                      />
                    </Field>
                  </div>
                </Form>
              )}
              {modal === "caso" && newCaseClient && (
                <Form
                  submit={async (f) => {
                    const result = await api<Case>("/cases", "POST", {
                      client_id: newCaseClient.id,
                      area: str(f, "area"),
                      subject: str(f, "subject"),
                      description: str(f, "description"),
                      initial_stage: str(f, "initial_stage"),
                      current_stage: str(f, "current_stage"),
                      start_date: str(f, "start_date"),
                      responsible_id: num(f, "responsible_id"),
                      reference: str(f, "reference"),
                    });
                    setModal("");
                    setSelected(result);
                  }}
                >
                  <p className="full notice">
                    {newCaseClient.name} · {newCaseClient.code}
                  </p>
                  <Field label="Rama / área">
                    <input
                      name="area"
                      required
                      placeholder="Civil, penal, laboral…"
                    />
                  </Field>
                  <Field label="Materia">
                    <input name="subject" required />
                  </Field>
                  <Field label="Etapa de ingreso">
                    <input name="initial_stage" required />
                  </Field>
                  <Field label="Etapa actual">
                    <input name="current_stage" required />
                  </Field>
                  <Field label="Fecha de inicio">
                    <input
                      name="start_date"
                      type="date"
                      required
                      defaultValue={localDate()}
                    />
                  </Field>
                  <Field label="Responsable">
                    <select
                      name="responsible_id"
                      required
                      defaultValue={actor.id}
                    >
                      {users
                        .filter(
                          (x) => x.active && (isAdmin || x.id === actor.id),
                        )
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Expediente / referencia opcional">
                    <input name="reference" />
                  </Field>
                  <div className="full">
                    <Field label="Descripción breve">
                      <textarea name="description" required />
                    </Field>
                  </div>
                </Form>
              )}
              {modal === "usuario" && (
                <Form
                  submit={async (f) => {
                    const base = {
                      name: str(f, "name"),
                      can_create_clients: f.has("can_create_clients"),
                      can_create_cases: f.has("can_create_cases"),
                    };
                    if (editUser)
                      await api(`/users/${editUser.id}`, "PUT", {
                        ...base,
                        active: f.has("active"),
                        password: str(f, "password") || null,
                      });
                    else
                      await api("/users", "POST", {
                        ...base,
                        email: str(f, "email"),
                        password: str(f, "password"),
                      });
                    await done();
                  }}
                >
                  <Field label="Nombre">
                    <input name="name" required defaultValue={editUser?.name} />
                  </Field>
                  {!editUser && (
                    <Field label="Correo de acceso">
                      <input name="email" type="email" required />
                    </Field>
                  )}
                  <Field
                    label={
                      editUser
                        ? "Nueva contraseña (opcional)"
                        : "Contraseña (mínimo 12 caracteres)"
                    }
                  >
                    <input
                      name="password"
                      type="password"
                      minLength={12}
                      required={!editUser}
                      autoComplete="new-password"
                    />
                  </Field>
                  <div className="full flex gap-5 text-sm">
                    <label>
                      <input
                        type="checkbox"
                        name="can_create_clients"
                        defaultChecked={editUser?.can_create_clients}
                      />{" "}
                      Crear clientes
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        name="can_create_cases"
                        defaultChecked={editUser?.can_create_cases}
                      />{" "}
                      Crear casos
                    </label>
                    {editUser && (
                      <label>
                        <input
                          type="checkbox"
                          name="active"
                          defaultChecked={editUser.active}
                        />{" "}
                        Cuenta activa
                      </label>
                    )}
                  </div>
                  <p className="full muted text-xs">
                    Autoriza cada caso desde su ficha. Estos permisos no
                    conceden acceso financiero.
                  </p>
                </Form>
              )}
            </Modal>
          )}
        </main>
      </div>
    </div>
  );
}
