import { Badge, Empty } from "../../../components/ui/index";
import type { LexioState } from "../../../hooks/useLexio";
import { alertsService } from "../../../services/alerts";
import type { Alert } from "../../../types/index";
import { dateLabel, money } from "../../../utils/format";

type Props = Pick<
  LexioState,
  "isAdmin" | "busy" | "openCase" | "userName" | "setError" | "load"
> & { data: Alert[] };
export default function AlertTable({
  data,
  isAdmin,
  busy,
  openCase,
  userName,
  setError,
  load,
}: Props) {
  return !data.length ? (
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
            <tr key={x.id} className={x.urgent ? "alert-urgent" : undefined}>
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
              </td>
              <td>
                {!x.urgent && (
                  <button
                    className="link-button"
                    disabled={busy}
                    onClick={async () => {
                      setError("");
                      try {
                        await alertsService.read(x.id);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Error");
                      }
                    }}
                  >
                    Marcar leído
                  </button>
                )}
                {x.can_attend && (
                  <button
                    className="link-button"
                    disabled={busy}
                    onClick={async () => {
                      setError("");
                      try {
                        await alertsService.attend(x.id);
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Error");
                      }
                    }}
                  >
                    Marcar atendido
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
