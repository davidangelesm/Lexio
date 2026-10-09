import { useState } from "react";
import { Badge, Empty } from "../../../components/ui";
import { alertsService } from "../../../services/alerts";
import { casesService } from "../../../services/cases";
import type { Alert } from "../../../types";
import { dateLabel, money } from "../../../utils/format";
type Props = {
  data: Alert[];
  isAdmin: boolean;
  busy: boolean;
  load: () => Promise<void>;
  openCase: (id: number) => Promise<void>;
};
export default function AlertTable({
  data,
  isAdmin,
  busy,
  load,
  openCase,
}: Props) {
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
                <th>Cliente</th>
                <th>Alerta</th>
                <th>Vencimiento</th>
                <th>Abogado responsable</th>
                {isAdmin && <th>Saldo de honorarios</th>}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((item) => (
                <tr key={item.id} className={item.urgent ? "alert-urgent" : ""}>
                  <td>
                    <strong>{item.client_name}</strong>
                    <small>{item.client_code}</small>
                  </td>
                  <td>
                    <Badge>
                      {item.urgent
                        ? "Urgente · vencido"
                        : item.kind === "pago"
                          ? "Pago"
                          : "Legal"}
                    </Badge>
                    <p className="alert-description">{item.description}</p>
                  </td>
                  <td>
                    {dateLabel(item.target_date)}
                    <small>
                      {item.urgent
                        ? "Requiere atención"
                        : item.anticipation > 0
                          ? `Aviso de ${item.anticipation} ${item.anticipation === 1 ? "día hábil" : "días hábiles"}`
                          : "Vence hoy"}
                    </small>
                  </td>
                  <td>{item.responsible_name}</td>
                  {isAdmin && (
                    <td>{item.balance != null ? money(item.balance) : "—"}</td>
                  )}
                  <td>
                    <div className="actions">
                      <button
                        className="secondary"
                        disabled={busy || working}
                        onClick={() => void openCase(item.case_id)}
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
                      {item.kind === "legal" &&
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
