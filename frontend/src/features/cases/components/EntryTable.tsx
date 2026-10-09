import { useState } from "react";
import { Badge, Empty } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Entry } from "../../../types";
import { dateLabel, dateTimeLabels } from "../../../utils/format";
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Actuación</th>
                <th>Asunto</th>
                <th>Tipo de asunto</th>
                <th>Descripción</th>
                <th>Alerta</th>
                <th>Responsable / registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const registered = dateTimeLabels(entry.created_at);
                return (
                  <tr key={entry.id}>
                    <td>{dateLabel(entry.action_date)}</td>
                    <td>{entry.subject}</td>
                    <td>
                      <Badge>
                        {entry.subject_type === "legal" ? "Legal" : "Otro"}
                      </Badge>
                    </td>
                    <td className="entry-description">{entry.description}</td>
                    <td>
                      {entry.alert_date ? (
                        <>
                          {dateLabel(entry.alert_date)}
                          <small>
                            <Badge>
                              {entry.attended ? "Atendido" : "Pendiente"}
                            </Badge>
                          </small>
                        </>
                      ) : (
                        "Sin alerta"
                      )}
                    </td>
                    <td>
                      {entry.responsible_name}
                      <small>{registered.date}</small>
                      <small>{registered.time}</small>
                    </td>
                    <td>
                      <div className="actions">
                        {canEdit && edit && (
                          <button
                            className="secondary"
                            disabled={busy || working}
                            onClick={() => edit(entry)}
                          >
                            Editar
                          </button>
                        )}
                        {entry.alert_date &&
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
