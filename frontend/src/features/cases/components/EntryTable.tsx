import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Badge, Empty } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Entry } from "../../../types";
import { dateLabel, dateTimeLabels, timeLabel } from "../../../utils/format";

const DESCRIPTION_CLAMP_CHARS = 180;
const DESCRIPTION_CLAMP_LINES = 3;

export function needsDescriptionClamp(description: string): boolean {
  const trimmed = description.trim();
  if (!trimmed) return false;
  return (
    trimmed.length > DESCRIPTION_CLAMP_CHARS ||
    trimmed.split(/\r?\n/).length > DESCRIPTION_CLAMP_LINES
  );
}

type Props = {
  entries: Entry[];
  canAttend?: boolean;
  canEdit?: boolean;
  edit?: (entry: Entry) => void;
  busy?: boolean;
  load: () => Promise<void>;
};
export default function EntryTable({
  entries,
  canAttend,
  canEdit = false,
  edit,
  busy = false,
  load,
}: Props) {
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function attend(id: number) {
    setWorking(true);
    setError("");
    try {
      await casesService.attendEntry(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar atendido.");
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {entries.length ? (
        <div
          className="table-wrap entry-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Bitácora del caso"
        >
          <table className="entry-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Asunto y descripción</th>
                <th>Alerta</th>
                <th>Responsable / registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const registered = dateTimeLabels(entry.created_at);
                const canClamp = needsDescriptionClamp(entry.description);
                const isExpanded = expandedIds.has(entry.id);
                const descId = `entry-desc-${entry.id}`;
                return (
                  <tr key={entry.id}>
                    <td className="entry-col-date">
                      {dateLabel(entry.action_date)}
                    </td>
                    <td className="entry-col-detail">
                      <div className="entry-detail-head">
                        <strong className="entry-subject">
                          {entry.subject}
                        </strong>
                        <Badge>
                          {entry.subject_type === "legal" ? "Legal" : "Otro"}
                        </Badge>
                      </div>
                      <div className="entry-description">
                        <p
                          id={descId}
                          className={
                            canClamp && !isExpanded
                              ? "entry-description-text is-clamped"
                              : "entry-description-text"
                          }
                        >
                          {entry.description}
                        </p>
                        {canClamp && (
                          <button
                            type="button"
                            className="entry-toggle"
                            aria-expanded={isExpanded}
                            aria-controls={descId}
                            onClick={() => toggleExpanded(entry.id)}
                          >
                            <ChevronDown
                              size={14}
                              className="entry-toggle-icon"
                              aria-hidden="true"
                            />
                            {isExpanded ? "Mostrar menos" : "Ver completa"}
                          </button>
                        )}
                        {entry.payment_event && (
                          <small className="entry-payment-note">
                            Pago por evento: {entry.payment_event} ·{" "}
                            {entry.payment_activated
                              ? "Vence con la alerta de la actuación"
                              : "Esperando fecha de alerta"}
                          </small>
                        )}
                      </div>
                    </td>
                    <td className="entry-col-alert">
                      {entry.alert_date ? (
                        <>
                          {dateLabel(entry.alert_date)}
                          {entry.alert_time && (
                            <small>Hora: {timeLabel(entry.alert_time)}</small>
                          )}
                          <small>
                            <Badge>
                              {entry.attended ? "Atendido" : "Pendiente"}
                            </Badge>
                          </small>
                        </>
                      ) : (
                        <>
                          Sin alerta
                          {(entry.can_attend ||
                            entry.payment_installment_id ||
                            entry.attended) && (
                            <small>
                              <Badge>
                                {entry.attended ? "Atendido" : "Pendiente"}
                              </Badge>
                            </small>
                          )}
                        </>
                      )}
                    </td>
                    <td className="entry-col-meta">
                      {entry.responsible_name}
                      <small>{registered.date}</small>
                      <small>{registered.time}</small>
                    </td>
                    <td className="entry-col-actions">
                      <div className="actions entry-actions">
                        {canEdit && edit && (
                          <button
                            className="secondary"
                            disabled={busy || working}
                            onClick={() => edit(entry)}
                          >
                            Editar
                          </button>
                        )}
                        {(entry.alert_date ||
                          entry.can_attend ||
                          entry.payment_installment_id) &&
                          !entry.attended &&
                          (canAttend ?? entry.can_attend) && (
                            <button
                              className="primary"
                              disabled={busy || working}
                              onClick={() => void attend(entry.id)}
                            >
                              Marcar atendido
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          text={
            busy
              ? "Cargando actuaciones…"
              : "Todavía no hay actuaciones registradas."
          }
        />
      )}
    </>
  );
}
