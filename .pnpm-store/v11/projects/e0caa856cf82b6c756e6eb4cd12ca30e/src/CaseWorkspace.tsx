import { useEffect, useState } from "react";
import { ArrowLeft, Plus, ExternalLink, FileText, Pencil } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { api, dateLabel, localDate, money } from "./api";
import { Badge, Card, Empty, Field, Form, Modal, num, str } from "./components";
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
} from "./types";

interface Plan {
  amount: string;
  percentage: string;
  condition: string;
  due_date: string;
  event_id: string;
  offset_days: number;
  day_basis: string;
}
const newPlan = (): Plan => ({
  amount: "",
  percentage: "",
  condition: "fecha",
  due_date: localDate(),
  event_id: "",
  offset_days: 0,
  day_basis: "calendario",
});

export default function CaseWorkspace({
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
  const root = `/cases/${caseData.id}`;
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
        api<Case>(root),
        api<Entry[]>(`${root}/entries`),
        api<Task[]>(`${root}/tasks`),
        api<Event[]>(`${root}/events`),
        api<FileLink[]>(`${root}/files`),
        api<Service[]>(`${root}/services`),
        isAdmin ? api<Access[]>(`${root}/access`) : Promise.resolve([]),
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
  }, [selected.id]); // Requests scoped to this case only.
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
    const result = await api<{ url: string }>(`/files/${id}/open`);
    if ("__TAURI_INTERNALS__" in window) await openUrl(result.url);
    else window.open(result.url, "_blank", "noopener,noreferrer");
  }
  async function beginPayment(s: Service) {
    try {
      const proposal = await api<Installment[]>(
        `/services/${s.id}/payment-proposal`,
      );
      setService({ ...s, installments: proposal });
      setAllocations({});
      setPaymentId(undefined);
      setModal("abono");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }
  const responsibleSelect = (value: number = actor.id) => (
    <select name="responsible_id" defaultValue={value} required>
      {(isAdmin
        ? authorized
        : users.filter(
            (x) =>
              x.id === actor.id ||
              x.id === caseData.responsible_id ||
              tasks.some((t) => t.responsible_id === x.id),
          )
      ).map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </select>
  );

  return (
    <>
      <button
        className="link-button mb-5 flex items-center gap-2"
        onClick={back}
      >
        <ArrowLeft size={15} /> Volver a casos
      </button>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {caseData.client.code} · {caseData.code}
          </p>
          <h1>{caseData.subject}</h1>
          <p>
            {caseData.client.name} · {caseData.area} · {caseData.current_stage}
          </p>
        </div>
        <div className="actions">
          <Badge>{caseData.status}</Badge>
          {canEdit && (
            <button className="secondary" onClick={() => setModal("caso")}>
              <Pencil size={14} />
              Editar ficha
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {loading && <p className="muted">Actualizando ficha…</p>}
      <Card>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 text-sm">
          <div>
            <small>Responsable principal</small>
            <p className="mt-2 mb-0">{userName(caseData.responsible_id)}</p>
          </div>
          <div>
            <small>Fecha de inicio</small>
            <p className="mt-2 mb-0">{dateLabel(caseData.start_date)}</p>
          </div>
          <div>
            <small>Expediente o referencia</small>
            <p className="mt-2 mb-0">
              {caseData.reference || "Asunto sin expediente"}
            </p>
          </div>
          <div>
            <small>Tu autorización</small>
            <p className="mt-2 mb-0">
              {canEdit ? "Lectura y edición" : "Solo lectura"}
            </p>
          </div>
        </div>
        <p className="mt-5 mb-0 text-sm muted">{caseData.description}</p>
      </Card>
      <div className="tabs">
        {[
          ["bitacora", "Bitácora"],
          ["tareas", "Vencimientos"],
          ["eventos", "Eventos"],
          ["archivos", "Archivos"],
          ["servicios", isAdmin ? "Servicios y finanzas" : "Servicios"],
          ...(isAdmin ? [["permisos", "Autorizaciones"]] : []),
        ].map(([key, label]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "bitacora" && (
        <Card>
          <div className="card-head">
            <h2>Historia del caso</h2>
            {canEdit && (
              <button
                className="primary"
                onClick={() => {
                  setEditEntry(undefined);
                  setModal("actuacion");
                }}
              >
                <Plus size={15} />
                Actuación
              </button>
            )}
          </div>
          {!entries.length ? (
            <Empty />
          ) : (
            <div className="timeline">
              {entries.map((x) => (
                <article key={x.id}>
                  <Badge>{dateLabel(x.action_date)}</Badge>
                  <p>{x.description}</p>
                  <small>
                    Registró {userName(x.registered_by)} ·{" "}
                    {dateLabel(x.created_at)} {x.created_at.slice(11, 16)} UTC
                  </small>
                  {canEdit && (
                    <button
                      className="link-button ml-3"
                      onClick={() => {
                        setEditEntry(x);
                        setModal("actuacion");
                      }}
                    >
                      Corregir
                    </button>
                  )}
                  {x.is_payment_event && <Badge>Evento para revisión</Badge>}
                </article>
              ))}
            </div>
          )}
        </Card>
      )}
      {tab === "tareas" && (
        <Card>
          <div className="card-head">
            <h2>Vencimientos procesales</h2>
            {canEdit && (
              <button
                className="primary"
                onClick={() => {
                  setEditTask(undefined);
                  setModal("tarea");
                }}
              >
                <Plus size={15} />
                Tarea
              </button>
            )}
          </div>
          <p className="muted text-xs">
            La fecha límite la valida el responsable. Los avisos usan lunes a
            viernes; no se calculan plazos jurídicos.
          </p>
          {!tasks.length ? (
            <Empty />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Responsable</th>
                    <th>Fecha límite</th>
                    <th>Estado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((x) => (
                    <tr key={x.id}>
                      <td>{x.description}</td>
                      <td>{userName(x.responsible_id)}</td>
                      <td>{dateLabel(x.due_date)}</td>
                      <td>
                        <Badge>{x.status}</Badge>
                      </td>
                      <td>
                        {canEdit && (
                          <button
                            className="link-button"
                            onClick={() => {
                              setEditTask(x);
                              setModal("tarea");
                            }}
                          >
                            Editar / atender
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {tab === "eventos" && (
        <Card>
          <div className="card-head">
            <h2>Audiencias y eventos concretos</h2>
            {canEdit && (
              <button
                className="primary"
                onClick={() => {
                  setEditEvent(undefined);
                  setModal("evento");
                }}
              >
                <Plus size={15} />
                Evento
              </button>
            )}
          </div>
          {!events.length ? (
            <Empty />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Acto</th>
                    <th>Programado</th>
                    <th>Hecho efectivo</th>
                    <th>Revisión</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {events.map((x) => (
                    <tr key={x.id}>
                      <td>{x.description}</td>
                      <td>{dateLabel(x.scheduled_date)}</td>
                      <td>
                        {x.effective_kind || "Sin confirmar"}
                        <small>{dateLabel(x.effective_date)}</small>
                      </td>
                      <td>
                        {x.revision}
                        {isAdmin && x.reviewed_revision < x.revision && (
                          <button
                            className="link-button block"
                            onClick={() =>
                              void action(() =>
                                api(`${root}/events/${x.id}/review`, "POST"),
                              )
                            }
                          >
                            Marcar revisado
                          </button>
                        )}
                      </td>
                      <td>
                        {canEdit && (
                          <button
                            className="link-button"
                            onClick={() => {
                              setEditEvent(x);
                              setModal("evento");
                            }}
                          >
                            Registrar / reprogramar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      {tab === "archivos" && (
        <Card>
          <div className="card-head">
            <h2>Documentos del caso</h2>
            {canEdit && (
              <button className="primary" onClick={() => setModal("archivo")}>
                <Plus size={15} />
                Enlace de archivo
              </button>
            )}
          </div>
          <p className="notice">
            Usa enlaces privados de Google Drive y concede acceso allí solo a
            los usuarios autorizados. El permiso de Lexio no revoca permisos
            externos de Drive.
          </p>
          {!files.length ? (
            <Empty />
          ) : (
            files.map((x) => (
              <div
                className="flex justify-between py-4 border-b border-gray-100"
                key={x.id}
              >
                <div className="flex gap-3 items-center">
                  <FileText size={20} />
                  <span>{x.title}</span>
                  <Badge>{x.classification}</Badge>
                </div>
                <button
                  className="secondary"
                  onClick={() => void action(() => openFile(x.id))}
                >
                  <ExternalLink size={14} />
                  Abrir
                </button>
              </div>
            ))
          )}
        </Card>
      )}
      {tab === "servicios" && (
        <>
          <div className="page-head">
            <h2>Alcances contratados</h2>
            {isAdmin && (
              <button
                className="primary"
                onClick={() => {
                  setPlans([newPlan()]);
                  setPercent(false);
                  setModal("servicio");
                }}
              >
                <Plus size={15} />
                Contratar servicio
              </button>
            )}
          </div>
          {!services.length && (
            <Empty text="Las etapas futuras no generan deuda hasta su contratación." />
          )}
          {services.map((s) => (
            <Card key={s.id}>
              <div className="card-head">
                <div>
                  <h2>{s.scope}</h2>
                  <small>
                    {s.stage} · {s.mode} · {dateLabel(s.contract_date)}
                  </small>
                </div>
                {isAdmin && (
                  <div className="text-right">
                    <strong>{money(s.fee)}</strong>
                    <br />
                    <button
                      className="link-button mt-2"
                      onClick={() => void beginPayment(s)}
                    >
                      Registrar abono
                    </button>
                  </div>
                )}
              </div>
              {isAdmin && (
                <>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Cuota / condición</th>
                          <th>Vencimiento</th>
                          <th>Monto</th>
                          <th>Aplicado</th>
                          <th>Saldo</th>
                          <th>Estado</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {s.installments?.map((x) => (
                          <tr key={x.id}>
                            <td>
                              Cuota {x.number}
                              <small>
                                {x.condition}
                                {x.event_id
                                  ? ` · evento ${x.event_id} · ${x.offset_days} días (${x.day_basis})`
                                  : ""}
                              </small>
                              {x.payments?.map((p) => (
                                <small key={p.id}>
                                  {dateLabel(p.payment_date)} ·{" "}
                                  {money(p.applied_amount)}{" "}
                                  {p.reversed_at ? "· reversado" : ""}
                                </small>
                              ))}
                            </td>
                            <td>
                              {dateLabel(x.due_date)}
                              {x.review_required && x.provisional_date && (
                                <small>
                                  Provisional: {dateLabel(x.provisional_date)}
                                </small>
                              )}
                            </td>
                            <td>{money(x.amount)}</td>
                            <td>{money(x.paid)}</td>
                            <td>{money(x.balance)}</td>
                            <td>
                              <Badge>{x.state}</Badge>
                            </td>
                            <td>
                              {x.event_id && (
                                <button
                                  className="link-button"
                                  onClick={() => {
                                    setQuota(x);
                                    setModal("vincular");
                                  }}
                                >
                                  Vincular evento
                                </button>
                              )}
                              {x.condition === "fecha" &&
                                Number(x.balance) > 0 && (
                                  <button
                                    className="link-button"
                                    onClick={() => {
                                      setQuota(x);
                                      setModal("reprogramar");
                                    }}
                                  >
                                    Reprogramar
                                  </button>
                                )}
                              {x.review_required && (
                                <button
                                  className="link-button"
                                  onClick={() =>
                                    void action(() =>
                                      api(
                                        `/installments/${x.id}/confirm`,
                                        "POST",
                                      ),
                                    )
                                  }
                                >
                                  Confirmar evento
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3 className="text-sm mt-5">Abonos vigentes</h3>
                  {!s.payments?.length ? (
                    <small>Sin abonos.</small>
                  ) : (
                    s.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex justify-between gap-3 text-sm py-3 border-b border-gray-100"
                      >
                        <span>
                          {dateLabel(p.payment_date)} · {money(p.amount)} ·{" "}
                          {p.method}
                        </span>
                        <div className="actions">
                          <button
                            className="link-button"
                            onClick={() => {
                              setService(s);
                              setPaymentId(p.id);
                              setAllocations({});
                              setModal("credito");
                            }}
                          >
                            Aplicar crédito
                          </button>
                          <button
                            className="link-button"
                            onClick={() => {
                              setPaymentId(p.id);
                              setModal("reversar");
                            }}
                          >
                            Reversar
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}
            </Card>
          ))}
        </>
      )}
      {tab === "permisos" && isAdmin && (
        <Card>
          <div className="card-head">
            <h2>Usuarios autorizados en este caso</h2>
            <button className="primary" onClick={() => setModal("permiso")}>
              <Plus size={15} />
              Autorizar
            </button>
          </div>
          {access.map((x) => (
            <div
              key={x.id}
              className="flex justify-between py-4 border-b border-gray-100"
            >
              <span>
                {userName(x.user_id)} ·{" "}
                {x.level === "edit" ? "Lectura y edición" : "Lectura"}
              </span>
              <button
                className="link-button"
                onClick={() =>
                  void action(() =>
                    api(`${root}/access/${x.user_id}`, "DELETE"),
                  )
                }
              >
                Revocar
              </button>
            </div>
          ))}
        </Card>
      )}

      {modal && (
        <Modal
          title={
            {
              caso: "Editar ficha del caso",
              actuacion: "Registrar actuación",
              tarea: "Vencimiento procesal",
              evento: "Evento concreto",
              archivo: "Registrar enlace",
              servicio: "Contratar servicio y definir cuotas",
              abono: "Registrar abono y confirmar aplicación",
              credito: "Aplicar crédito disponible",
              reversar: "Reversar abono",
              permiso: "Autorizar usuario",
              reprogramar: "Reprogramar cuota por fecha",
              vincular: "Vincular acto concreto a cuota",
            }[modal] || ""
          }
          close={() => setModal("")}
        >
          {modal === "caso" && (
            <Form
              submit={async (f) => {
                await api(root, "PUT", {
                  area: str(f, "area"),
                  subject: str(f, "subject"),
                  description: str(f, "description"),
                  current_stage: str(f, "current_stage"),
                  status: str(f, "status"),
                  responsible_id: num(f, "responsible_id"),
                  reference: str(f, "reference"),
                });
                await done();
              }}
            >
              <Field label="Rama / área">
                <input name="area" required defaultValue={caseData.area} />
              </Field>
              <Field label="Materia">
                <input
                  name="subject"
                  required
                  defaultValue={caseData.subject}
                />
              </Field>
              <Field label="Etapa actual">
                <input
                  name="current_stage"
                  required
                  defaultValue={caseData.current_stage}
                />
              </Field>
              <Field label="Estado">
                <select name="status" defaultValue={caseData.status}>
                  {["activo", "suspendido", "concluido"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Responsable autorizado">
                {responsibleSelect(caseData.responsible_id)}
              </Field>
              <Field label="Expediente / referencia">
                <input name="reference" defaultValue={caseData.reference} />
              </Field>
              <div className="full">
                <Field label="Descripción">
                  <textarea
                    name="description"
                    required
                    defaultValue={caseData.description}
                  />
                </Field>
              </div>
            </Form>
          )}
          {modal === "actuacion" && (
            <Form
              submit={async (f) => {
                await api(
                  editEntry
                    ? `${root}/entries/${editEntry.id}`
                    : `${root}/entries`,
                  editEntry ? "PUT" : "POST",
                  {
                    action_date: str(f, "action_date"),
                    description: str(f, "description"),
                    is_payment_event: editEntry
                      ? editEntry.is_payment_event
                      : f.has("is_payment_event"),
                  },
                );
                await done();
              }}
            >
              <Field label="Fecha real de actuación">
                <input
                  type="date"
                  name="action_date"
                  required
                  defaultValue={editEntry?.action_date || localDate()}
                />
              </Field>
              <div className="full">
                <Field label="Descripción breve">
                  <textarea
                    name="description"
                    required
                    defaultValue={editEntry?.description}
                  />
                </Field>
              </div>
              {!editEntry && (
                <label className="text-sm">
                  <input type="checkbox" name="is_payment_event" /> Acto que
                  podría activar una cuota
                </label>
              )}
              <p className="full muted text-xs">
                El usuario y la fecha de registro se guardan automáticamente y
                no se pueden editar.
              </p>
            </Form>
          )}
          {modal === "tarea" && (
            <Form
              submit={async (f) => {
                await api(
                  editTask ? `${root}/tasks/${editTask.id}` : `${root}/tasks`,
                  editTask ? "PUT" : "POST",
                  {
                    description: str(f, "description"),
                    responsible_id: num(f, "responsible_id"),
                    due_date: str(f, "due_date"),
                    status: str(f, "status"),
                    entry_id: str(f, "entry_id") ? num(f, "entry_id") : null,
                  },
                );
                await done();
              }}
            >
              <div className="full">
                <Field label="Descripción">
                  <input
                    name="description"
                    required
                    defaultValue={editTask?.description}
                  />
                </Field>
              </div>
              <Field label="Responsable autorizado">
                {responsibleSelect(
                  editTask?.responsible_id || caseData.responsible_id,
                )}
              </Field>
              <Field label="Fecha límite validada">
                <input
                  type="date"
                  name="due_date"
                  required
                  defaultValue={editTask?.due_date || localDate()}
                />
              </Field>
              <Field label="Estado">
                <select
                  name="status"
                  defaultValue={editTask?.status || "pendiente"}
                >
                  {["pendiente", "atendida", "cancelada"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Actuación de origen (opcional)">
                <select name="entry_id" defaultValue={editTask?.entry_id || ""}>
                  <option value="">Sin actuación</option>
                  {entries.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.description.slice(0, 65)}
                    </option>
                  ))}
                </select>
              </Field>
            </Form>
          )}
          {modal === "evento" && (
            <Form
              submit={async (f) => {
                await api(
                  editEvent
                    ? `${root}/events/${editEvent.id}`
                    : `${root}/events`,
                  editEvent ? "PUT" : "POST",
                  {
                    description: str(f, "description"),
                    entry_id: str(f, "entry_id") ? num(f, "entry_id") : null,
                    scheduled_date: str(f, "scheduled_date") || null,
                    effective_date: str(f, "effective_date") || null,
                    effective_kind: str(f, "effective_kind") || null,
                  },
                );
                await done();
              }}
            >
              <div className="full">
                <Field label="Identifica la audiencia, sentencia o acto específico">
                  <input
                    name="description"
                    required
                    defaultValue={editEvent?.description}
                  />
                </Field>
              </div>
              <Field label="Fecha programada (opcional)">
                <input
                  type="date"
                  name="scheduled_date"
                  defaultValue={editEvent?.scheduled_date || ""}
                />
              </Field>
              <Field label="Actuación de origen">
                <select
                  name="entry_id"
                  defaultValue={editEvent?.entry_id || ""}
                >
                  <option value="">Sin actuación</option>
                  {entries.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.description.slice(0, 65)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Condición efectiva">
                <select
                  name="effective_kind"
                  defaultValue={editEvent?.effective_kind || ""}
                >
                  <option value="">Todavía pendiente</option>
                  {["realizacion", "emision", "notificacion"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Fecha efectiva">
                <input
                  type="date"
                  name="effective_date"
                  defaultValue={editEvent?.effective_date || ""}
                />
              </Field>
              <p className="full notice">
                Cambiar el evento requiere una nueva confirmación de David en
                las cuotas vinculadas.
              </p>
            </Form>
          )}
          {modal === "archivo" && (
            <Form
              submit={async (f) => {
                await api(`${root}/files`, "POST", {
                  title: str(f, "title"),
                  url: str(f, "url"),
                  classification: str(f, "classification"),
                });
                await done();
              }}
            >
              <Field label="Nombre del documento">
                <input name="title" required />
              </Field>
              <Field label="Clasificación">
                <select name="classification">
                  <option value="operativo">Operativo</option>
                  {isAdmin && (
                    <option value="financiero">Financiero · exclusivo</option>
                  )}
                </select>
              </Field>
              <div className="full">
                <Field label="Enlace HTTPS de Google Drive">
                  <input type="url" name="url" required />
                </Field>
              </div>
            </Form>
          )}
          {modal === "permiso" && (
            <Form
              submit={async (f) => {
                await api(`${root}/access`, "POST", {
                  user_id: num(f, "user_id"),
                  level: str(f, "level"),
                });
                await done();
              }}
            >
              <Field label="Usuario">
                <select name="user_id" required>
                  {users
                    .filter((x) => x.active && x.role !== "admin")
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Nivel">
                <select name="level">
                  <option value="read">Lectura</option>
                  <option value="edit">Lectura y edición</option>
                </select>
              </Field>
            </Form>
          )}
          {modal === "servicio" && (
            <Form
              submit={async (f) => {
                await api(`${root}/services`, "POST", {
                  mode: str(f, "mode"),
                  scope: str(f, "scope"),
                  stage: str(f, "stage"),
                  contract_date: str(f, "contract_date"),
                  fee: str(f, "fee"),
                  installments: plans.map((p) => ({
                    amount: percent ? null : p.amount,
                    percentage: percent ? p.percentage : null,
                    condition: p.condition,
                    due_date: p.condition === "fecha" ? p.due_date : null,
                    event_id:
                      p.condition === "fecha" ? null : Number(p.event_id),
                    offset_days: p.offset_days,
                    day_basis: p.day_basis,
                  })),
                });
                await done();
              }}
            >
              <Field label="Modalidad">
                <select name="mode">
                  {["etapa", "acto", "integral", "otro"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </Field>
              <Field label="Etapa / acto cubierto">
                <input name="stage" required />
              </Field>
              <div className="full">
                <Field label="Alcance contratado">
                  <textarea name="scope" required />
                </Field>
              </div>
              <Field label="Fecha de contratación">
                <input
                  type="date"
                  name="contract_date"
                  required
                  defaultValue={localDate()}
                />
              </Field>
              <Field label="Honorarios S/">
                <input
                  name="fee"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </Field>
              <div className="full">
                <label className="text-sm">
                  <input
                    type="checkbox"
                    checked={percent}
                    onChange={(e) => setPercent(e.target.checked)}
                  />{" "}
                  Cuotas por porcentaje (suman 100%)
                </label>
                {plans.map((p, i) => (
                  <div className="plan-row" key={i}>
                    <Field label={`Cuota ${i + 1} · ${percent ? "%" : "S/"}`}>
                      <input
                        type="number"
                        step={percent ? "0.0001" : "0.01"}
                        min="0.01"
                        required
                        value={percent ? p.percentage : p.amount}
                        onChange={(e) =>
                          updatePlan(
                            i,
                            percent
                              ? { percentage: e.target.value }
                              : { amount: e.target.value },
                          )
                        }
                      />
                    </Field>
                    <Field label="Condición">
                      <select
                        value={p.condition}
                        onChange={(e) =>
                          updatePlan(i, { condition: e.target.value })
                        }
                      >
                        {[
                          "fecha",
                          "programacion",
                          "realizacion",
                          "emision",
                          "notificacion",
                        ].map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    </Field>
                    {p.condition === "fecha" ? (
                      <Field label="Vencimiento">
                        <input
                          type="date"
                          required
                          value={p.due_date}
                          onChange={(e) =>
                            updatePlan(i, { due_date: e.target.value })
                          }
                        />
                      </Field>
                    ) : (
                      <>
                        <Field label="Evento específico">
                          <select
                            required
                            value={p.event_id}
                            onChange={(e) =>
                              updatePlan(i, { event_id: e.target.value })
                            }
                          >
                            <option value="">Seleccionar evento</option>
                            {events.map((x) => (
                              <option key={x.id} value={x.id}>
                                {x.description}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Días antes (-) / después (+)">
                          <input
                            type="number"
                            value={p.offset_days}
                            onChange={(e) =>
                              updatePlan(i, {
                                offset_days: Number(e.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Regla de días">
                          <select
                            value={p.day_basis}
                            onChange={(e) =>
                              updatePlan(i, { day_basis: e.target.value })
                            }
                          >
                            <option value="calendario">Calendario</option>
                            <option value="lunes_viernes">
                              Lunes a viernes
                            </option>
                          </select>
                        </Field>
                      </>
                    )}
                    {plans.length > 1 && (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() =>
                          setPlans(plans.filter((_, j) => i !== j))
                        }
                      >
                        Quitar cuota
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setPlans([...plans, newPlan()])}
                >
                  <Plus size={14} />
                  Agregar cuota
                </button>
                <p className="muted text-xs mt-3">
                  Debe existir una cuota inicial por fecha. El redondeo
                  porcentual se ajusta en la última cuota.
                </p>
              </div>
            </Form>
          )}
          {(modal === "abono" || modal === "credito") && service && (
            <Form
              submit={async (f) => {
                const applications = Object.entries(allocations)
                  .filter(([, v]) => Number(v) > 0)
                  .map(([k, v]) => ({ installment_id: Number(k), amount: v }));
                if (modal === "credito")
                  await api(`/payments/${paymentId}/apply`, "POST", {
                    applications,
                  });
                else
                  await api(`/services/${service.id}/payments`, "POST", {
                    payment_date: str(f, "payment_date"),
                    amount: str(f, "amount"),
                    method: str(f, "method"),
                    receipt: str(f, "receipt"),
                    observation: str(f, "observation"),
                    applications,
                  });
                await done();
              }}
            >
              {modal === "abono" && (
                <>
                  <Field label="Fecha de abono">
                    <input
                      type="date"
                      name="payment_date"
                      required
                      max={localDate()}
                      defaultValue={localDate()}
                    />
                  </Field>
                  <Field label="Importe recibido S/">
                    <input
                      type="number"
                      name="amount"
                      required
                      min="0.01"
                      step="0.01"
                    />
                  </Field>
                  <Field label="Medio de pago">
                    <input
                      name="method"
                      required
                      placeholder="Transferencia, efectivo, Yape…"
                    />
                  </Field>
                  <Field label="Comprobante (referencia opcional)">
                    <input name="receipt" />
                  </Field>
                  <div className="full">
                    <Field label="Observación">
                      <textarea name="observation" />
                    </Field>
                  </div>
                </>
              )}
              <div className="full">
                <p className="notice">
                  Distribuye el abono entre cuotas. La lista propone primero la
                  cuota exigible más antigua. Lo recibido sin aplicar queda como
                  crédito separado.
                </p>
                {service.installments
                  ?.filter((x) => Number(x.balance) > 0)
                  .map((x) => (
                    <div className="flex gap-4 items-center py-2" key={x.id}>
                      <span className="text-sm flex-1">
                        Cuota {x.number} · {money(x.balance)} ·{" "}
                        {dateLabel(x.due_date)}
                      </span>
                      <input
                        className="max-w-36"
                        type="number"
                        step="0.01"
                        min="0"
                        max={x.balance}
                        aria-label={`Aplicar a cuota ${x.number}`}
                        value={allocations[x.id] || ""}
                        onChange={(e) =>
                          setAllocations({
                            ...allocations,
                            [x.id]: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
              </div>
            </Form>
          )}
          {modal === "vincular" && quota && (
            <Form
              submit={async (f) => {
                await api(`/installments/${quota.id}/event`, "PUT", {
                  event_id: num(f, "event_id"),
                });
                await done();
              }}
            >
              <div className="full">
                <Field label="Evento del caso">
                  <select
                    name="event_id"
                    required
                    defaultValue={quota.event_id || ""}
                  >
                    {events.map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.description}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="notice mt-4">
                  El vínculo no confirma el vencimiento. Después confirma el
                  efecto económico cuando se cumpla la condición.
                </p>
              </div>
            </Form>
          )}
          {modal === "reprogramar" && quota && (
            <Form
              submit={async (f) => {
                await api(`/installments/${quota.id}/reschedule`, "PUT", {
                  due_date: str(f, "due_date"),
                  reason: str(f, "reason"),
                });
                await done();
              }}
            >
              <Field label="Nueva fecha pactada">
                <input
                  type="date"
                  name="due_date"
                  required
                  defaultValue={quota.due_date || localDate()}
                />
              </Field>
              <Field label="Motivo">
                <input name="reason" required minLength={5} />
              </Field>
            </Form>
          )}
          {modal === "reversar" && (
            <Form
              label="Confirmar reversión"
              submit={async (f) => {
                await api(`/payments/${paymentId}/reverse`, "POST", {
                  reason: str(f, "reason"),
                });
                await done();
              }}
            >
              <p className="full notice">
                Se conserva el pago original y sus aplicaciones. La reversión
                restaura los saldos.
              </p>
              <div className="full">
                <Field label="Motivo de reversión">
                  <textarea name="reason" required minLength={5} />
                </Field>
              </div>
            </Form>
          )}
        </Modal>
      )}
    </>
  );
}
