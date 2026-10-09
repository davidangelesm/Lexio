import { ArrowLeft, Plus, Pencil, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Card, Empty, Modal } from "../../components/ui";
import { casesService } from "../../services/cases";
import { financeService } from "../../services/finance";
import type { Case, CaseTab, Client, Entry, Payment, User } from "../../types";
import { dateLabel, money } from "../../utils/format";
import CaseForm from "./forms/CaseForm";
import EntryForm from "./forms/EntryForm";
import PaymentForm from "./forms/PaymentForm";
import EntryTable from "./components/EntryTable";
import CaseAccess from "./components/CaseAccess";
type Props = {
  selected: Case;
  actor: User;
  users: User[];
  clients: Client[];
  initialTab?: CaseTab;
  back: () => void;
};
export default function CaseWorkspace({
  selected,
  actor,
  users,
  clients,
  initialTab = "bitacora",
  back,
}: Props) {
  const [item, setItem] = useState(selected);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [editEntry, setEditEntry] = useState<Entry>();
  const [modal, setModal] = useState("");
  const [remove, setRemove] = useState<Payment>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isAdmin = actor.role === "admin";
  const [tab, setTab] = useState<CaseTab>(isAdmin ? initialTab : "bitacora");
  const canEdit = isAdmin || item.access_level === "edit";
  async function load() {
    setBusy(true);
    setError("");
    try {
      const [caseData, acts] = await Promise.all([
        casesService.get(item.id),
        casesService.entries(item.id),
      ]);
      setItem(caseData);
      setEntries(acts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el caso.");
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    void load();
  }, [item.id]);
  useEffect(() => {
    setTab(isAdmin ? initialTab : "bitacora");
  }, [initialTab, isAdmin]);
  async function done() {
    setModal("");
    setEditEntry(undefined);
    setRemove(undefined);
    await load();
  }
  return (
    <>
      <button className="secondary mb-5" onClick={back}>
        <ArrowLeft size={15} />
        Volver
      </button>
      <div className="page-head">
        <div>
          <h1 className="client-title">{item.client.name}</h1>
          <h2>{item.process_type}</h2>
          <p>
            {item.client.code} · {item.area} · {item.initial_stage}
          </p>
        </div>
        <div className="actions">
          {canEdit && (
            <button className="secondary" onClick={() => setModal("caso")}>
              <Pencil size={15} />
              Editar caso
            </button>
          )}
          {isAdmin && (
            <button className="secondary" onClick={() => setModal("equipo")}>
              <Users size={15} />
              Equipo autorizado
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Card>
        <div className="card-head">
          <h2>Datos del cliente y proceso</h2>
          <Badge>{item.status === "activo" ? "Activo" : "Concluido"}</Badge>
        </div>
        <dl className="details-grid">
          <div>
            <dt>Documento</dt>
            <dd>
              {item.client.document_type} · {item.client.document_number}
            </dd>
          </div>
          <div>
            <dt>Celular</dt>
            <dd>{item.client.phone || "Sin registrar"}</dd>
          </div>
          <div>
            <dt>Correo</dt>
            <dd>{item.client.email || "Sin registrar"}</dd>
          </div>
          <div>
            <dt>Dirección</dt>
            <dd>{item.client.address || "Sin registrar"}</dd>
          </div>
          <div>
            <dt>Etapa de ingreso</dt>
            <dd>{item.initial_stage}</dd>
          </div>
          <div>
            <dt>Abogado responsable</dt>
            <dd>{item.responsible_name}</dd>
          </div>
        </dl>
      </Card>
      <div
        className="case-tabs"
        role="tablist"
        aria-label="Secciones del caso"
        onKeyDown={(event) => {
          if (!isAdmin) return;
          let next: CaseTab;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight")
            next = tab === "bitacora" ? "finanzas" : "bitacora";
          else if (event.key === "Home") next = "bitacora";
          else if (event.key === "End") next = "finanzas";
          else return;
          event.preventDefault();
          setTab(next);
          event.currentTarget
            .querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)
            ?.focus();
        }}
      >
        <button
          className={tab === "bitacora" ? "primary" : "secondary"}
          role="tab"
          id="case-bitacora-tab"
          data-tab="bitacora"
          aria-selected={tab === "bitacora"}
          aria-controls="case-bitacora-panel"
          tabIndex={tab === "bitacora" ? 0 : -1}
          onClick={() => setTab("bitacora")}
        >
          Bitácora
        </button>
        {isAdmin && (
          <button
            className={tab === "finanzas" ? "primary" : "secondary"}
            role="tab"
            id="case-finanzas-tab"
            data-tab="finanzas"
            aria-selected={tab === "finanzas"}
            aria-controls="case-finanzas-panel"
            tabIndex={tab === "finanzas" ? 0 : -1}
            onClick={() => setTab("finanzas")}
          >
            Control financiero
          </button>
        )}
      </div>
      {isAdmin && (
        <div
          role="tabpanel"
          id="case-finanzas-panel"
          aria-labelledby="case-finanzas-tab"
          tabIndex={0}
          hidden={tab !== "finanzas"}
        >
          <Card>
            <div className="card-head">
              <h2>Control financiero</h2>
              {item.fee != null && !item.cancelled && (
                <button className="primary" onClick={() => setModal("pago")}>
                  <Plus size={15} />
                  Registrar abono
                </button>
              )}
              {item.fee == null && (
                <button className="primary" onClick={() => setModal("caso")}>
                  Registrar honorarios
                </button>
              )}
            </div>
            {item.fee == null ? (
              <Empty text="Completa los honorarios y los plazos de pago de este caso." />
            ) : (
              <>
                <div className="finance-summary">
                  <div>
                    <span>Honorarios pactados</span>
                    <strong>{money(item.fee)}</strong>
                  </div>
                  <div>
                    <span>Total abonado</span>
                    <strong>{money(item.paid)}</strong>
                  </div>
                  <div>
                    <span>Saldo pendiente</span>
                    <strong>{money(item.balance)}</strong>
                    <Badge>
                      {item.cancelled ? "Cancelado" : "Pendiente de pago"}
                    </Badge>
                  </div>
                </div>
                <h3>Plazos de pago</h3>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cuota</th>
                        <th>Vencimiento</th>
                        <th>Importe</th>
                        <th>Abonado</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.installments || []).map((quota) => (
                        <tr key={quota.id}>
                          <td>Cuota {quota.number}</td>
                          <td>{dateLabel(quota.due_date)}</td>
                          <td>{money(quota.amount)}</td>
                          <td>{money(quota.paid)}</td>
                          <td>{money(quota.balance)}</td>
                          <td>
                            <Badge>
                              {Number(quota.balance) === 0
                                ? "Cancelado"
                                : quota.state === "vencido"
                                  ? "Vencido"
                                  : "Pendiente"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <h3 className="mt-6">Abonos registrados</h3>
                {item.payments?.length ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha de abono</th>
                          <th>Importe</th>
                          <th>Medio de pago</th>
                          <th>Corrección</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td>{dateLabel(payment.payment_date)}</td>
                            <td>{money(payment.amount)}</td>
                            <td>{payment.method || "Sin indicar"}</td>
                            <td>
                              <button
                                className="danger"
                                onClick={() => setRemove(payment)}
                              >
                                Eliminar abono
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty text="Todavía no hay abonos registrados." />
                )}
              </>
            )}
          </Card>
        </div>
      )}
      <div
        role="tabpanel"
        id="case-bitacora-panel"
        aria-labelledby="case-bitacora-tab"
        tabIndex={0}
        hidden={tab !== "bitacora"}
      >
        <Card>
          <div className="card-head">
            <h2>Bitácora del caso</h2>
            {canEdit && (
              <button
                className="primary"
                onClick={() => {
                  setEditEntry(undefined);
                  setModal("actuacion");
                }}
              >
                <Plus size={15} />
                Registrar actuación
              </button>
            )}
          </div>
          <EntryTable
            entries={entries}
            canAttend={canEdit}
            canEdit={canEdit}
            edit={(entry) => {
              setEditEntry(entry);
              setModal("actuacion");
            }}
            busy={busy}
            load={load}
          />
        </Card>
      </div>
      {modal && (
        <Modal
          title={
            modal === "caso"
              ? "Editar caso"
              : modal === "pago"
                ? "Registrar abono"
                : modal === "equipo"
                  ? "Equipo autorizado"
                  : editEntry
                    ? "Editar actuación"
                    : "Registrar actuación"
          }
          close={() => {
            setModal("");
            setEditEntry(undefined);
          }}
        >
          {modal === "caso" && (
            <CaseForm
              item={item}
              actor={actor}
              users={users}
              clients={clients}
              saved={(updated) => {
                setItem(updated);
                setModal("");
              }}
            />
          )}
          {modal === "pago" && <PaymentForm item={item} done={done} />}
          {modal === "actuacion" && (
            <EntryForm
              caseId={item.id}
              actor={actor}
              item={editEntry}
              done={done}
            />
          )}
          {modal === "equipo" && <CaseAccess caseId={item.id} users={users} />}
        </Modal>
      )}
      {remove && (
        <Modal title="Eliminar abono" close={() => setRemove(undefined)}>
          <p>
            Se eliminará el abono de {money(remove.amount)} del{" "}
            {dateLabel(remove.payment_date)}. El saldo se recalculará.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button className="secondary" onClick={() => setRemove(undefined)}>
              Conservar abono
            </button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await financeService.removePayment(remove.id);
                  await done();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo eliminar el abono.",
                  );
                  setBusy(false);
                }
              }}
            >
              Eliminar abono
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
