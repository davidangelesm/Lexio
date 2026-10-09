import { Bell, FolderOpen, RefreshCw, Wallet } from "lucide-react";
import { Badge, Card, Empty } from "../../components/ui";
import type { Alert, Dashboard, User } from "../../types";
import { dateLabel, localDate, money } from "../../utils/format";
import AlertTable from "../alerts/components/AlertTable";
type Props = {
  actor: User;
  dashboard?: Dashboard;
  alerts: Alert[];
  isAdmin: boolean;
  busy: boolean;
  load: () => Promise<void>;
  openCase: (id: number) => Promise<void>;
  setPage: (page: string) => void;
};
export default function DashboardPage({
  actor,
  dashboard,
  alerts,
  isAdmin,
  busy,
  load,
  openCase,
  setPage,
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
          <div className="dashboard-stats">
            <Card className="dashboard-stat">
              <FolderOpen size={21} />
              <p>Casos activos</p>
              <strong>{dashboard.counts.active_cases}</strong>
              <small>{dashboard.counts.total_cases} casos en total</small>
            </Card>
            <Card className="dashboard-stat">
              <Bell size={21} />
              <p>Alertas por revisar</p>
              <strong>{alerts.length}</strong>
              <small>
                {dashboard.counts.pending_legal_alerts}{" "}
                {dashboard.counts.pending_legal_alerts === 1
                  ? "obligación legal pendiente"
                  : "obligaciones legales pendientes"}
              </small>
            </Card>
            <Card className="dashboard-stat">
              {isAdmin ? <Wallet size={21} /> : <FolderOpen size={21} />}
              <p>{isAdmin ? "Saldo por cobrar" : "Casos concluidos"}</p>
              <strong>
                {isAdmin
                  ? money(dashboard.finance?.balance)
                  : dashboard.counts.concluded_cases}
              </strong>
              <small>
                {isAdmin
                  ? "Honorarios pendientes de pago"
                  : "De los casos a los que tienes acceso"}
              </small>
            </Card>
          </div>
          <Card>
            <div className="card-head">
              <div>
                <h2>Alertas y vencimientos</h2>
                <p className="muted card-description">
                  Primero los vencimientos más próximos y urgentes.
                </p>
              </div>
              <button className="secondary" onClick={() => setPage("alertas")}>
                Ver todas las alertas
              </button>
            </div>
            <AlertTable
              data={alerts.slice(0, 5)}
              isAdmin={isAdmin}
              busy={busy}
              load={load}
              openCase={openCase}
            />
          </Card>
          {isAdmin && (
            <Card>
              <div className="card-head">
                <div>
                  <h2>Cobros próximos</h2>
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
                            <small>
                              {item.client_code} · {item.process_type}
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
                              onClick={() => void openCase(item.case_id)}
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
