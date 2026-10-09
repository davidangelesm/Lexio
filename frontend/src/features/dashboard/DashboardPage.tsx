import { RefreshCw } from "lucide-react";
import { Badge, Card, Empty } from "../../components/ui";
import type { Alert, CaseTab, Dashboard, User } from "../../types";
import { dateLabel, localDate, money } from "../../utils/format";
import AlertTable from "./components/AlertTable";
type Props = {
  actor: User;
  dashboard?: Dashboard;
  alerts: Alert[];
  isAdmin: boolean;
  busy: boolean;
  load: () => Promise<void>;
  openCase: (id: number, tab?: CaseTab) => Promise<void>;
};
export default function DashboardPage({
  actor,
  dashboard,
  alerts,
  isAdmin,
  busy,
  load,
  openCase,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Tu jornada en perspectiva</p>
          <h1>Panel del día</h1>
          <p>
            Hola, {actor.name.split(" ")[0]}. Estas son las prioridades del
            estudio.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={15} /> Actualizar
        </button>
      </div>
      {dashboard ? (
        <>
          <Card>
            <div className="card-head">
              <div>
                <h2>Alertas procesales y otros</h2>
                <p className="muted card-description">
                  Primero los vencimientos más próximos y urgentes.
                </p>
              </div>
            </div>
            <AlertTable
              data={alerts.filter((item) => item.kind !== "pago")}
              busy={busy}
              load={load}
              openCase={openCase}
            />
          </Card>
          {isAdmin && (
            <Card>
              <div className="card-head">
                <div>
                  <h2>Alerta de cobros</h2>
                  <p className="muted card-description">
                    Cuotas pendientes de los próximos 30 días y cobros vencidos.
                  </p>
                </div>
              </div>
              {dashboard.upcoming_payments?.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Cliente y caso</th>
                        <th>Vencimiento</th>
                        <th>Saldo de la cuota</th>
                        <th>Estado</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.upcoming_payments.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.client_name}</strong>
                            <small>{item.client_code}</small>
                            <small>
                              {item.case_code} · {item.process_type}
                            </small>
                          </td>
                          <td>
                            {dateLabel(item.due_date)}
                            <small>Cuota {item.number}</small>
                          </td>
                          <td>{money(item.balance)}</td>
                          <td>
                            <Badge>
                              {item.due_date < localDate()
                                ? "Vencido"
                                : item.due_date === localDate()
                                  ? "Vence hoy"
                                  : "Pendiente"}
                            </Badge>
                          </td>
                          <td>
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void openCase(item.case_id, "finanzas")
                              }
                            >
                              Ver caso
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <Empty text="No hay cobros pendientes para los próximos 30 días." />
              )}
            </Card>
          )}
        </>
      ) : (
        <Empty
          text={busy ? "Cargando el panel…" : "Actualiza para cargar el panel."}
        />
      )}
    </>
  );
}
