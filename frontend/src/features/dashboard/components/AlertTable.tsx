import { useState } from "react";
import { Badge, Empty } from "../../../components/ui";
import { alertsService } from "../../../services/alerts";
import { casesService } from "../../../services/cases";
import type { Alert, CaseTab } from "../../../types";
import { dateLabel } from "../../../utils/format";
type Props = {
  data: Alert[];
  busy: boolean;
  load: () => Promise<void>;
  openCase: (id: number, tab?: CaseTab) => Promise<void>;
};
export default function AlertTable({ data, busy, load, openCase }: Props) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function action(item: Alert, attend: boolean) {
    setWorking(true);
    setError("");
    try {
      if (attend && item.entry_id)
        await casesService.attendEntry(item.entry_id);
      else await alertsService.read(item.id);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar la alerta.",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {data.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Cliente y caso</th>
                <th>Alerta</th>
                <th>Vencimiento</th>
                <th>Abogado responsable</th>
                <th>Descripción corta</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className={item.urgent ? "alert-urgent" : ""}>
                  <td>
                    <strong>{item.client_name}</strong>
                    <small>{item.client_code}</small>
                    <small>
                      {item.case_code} · {item.process_type}
                    </small>
                  </td>
                  <td>
                    <Badge>{item.kind === "otro" ? "Otro" : "Legal"}</Badge>
                  </td>
                  <td>
                    {dateLabel(item.target_date)}
                    <small>
                      {item.urgent
                        ? "Urgente · vencido"
                        : item.anticipation > 0
                          ? `Aviso de ${item.anticipation} ${item.anticipation === 1 ? "día hábil" : "días hábiles"}`
                          : "Vence hoy"}
                    </small>
                  </td>
                  <td>{item.responsible_name}</td>
                  <td className="alert-description">{item.subject}</td>
                  <td>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={busy || working}
                        onClick={() => void openCase(item.case_id, "bitacora")}
                      >
                        Ver caso
                      </button>
                      {!item.urgent && (
                        <button
                          className="secondary"
                          disabled={busy || working}
                          onClick={() => void action(item, false)}
                        >
                          Marcar leído
                        </button>
                      )}
                      {item.kind !== "pago" &&
                        item.can_attend &&
                        item.entry_id && (
                          <button
                            className="primary"
                            disabled={busy || working}
                            onClick={() => void action(item, true)}
                          >
                            Marcar atendido
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          text={busy ? "Cargando alertas…" : "No hay alertas pendientes."}
        />
      )}
    </>
  );
}
