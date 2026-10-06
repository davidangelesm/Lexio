import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, Empty } from "../../components/ui/index";
import type { LexioState } from "../../hooks/useLexio";
import type { Alert } from "../../types/index";
import { money } from "../../utils/format";

type Props = Pick<
  LexioState,
  | "busy"
  | "load"
  | "dashboard"
  | "isAdmin"
  | "setPage"
  | "userName"
  | "openCase"
> & {
  actor: NonNullable<LexioState["actor"]>;
  alertTable: (data: Alert[]) => ReactNode;
};
export default function DashboardPage({
  actor,
  busy,
  load,
  dashboard,
  isAdmin,
  setPage,
  alertTable,
  userName,
  openCase,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Tu jornada en perspectiva</p>
          <h1>Panel del día</h1>
          <p>
            Hola, {actor.name.split(" ")[0]}. Estas son las prioridades de tu
            estudio.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} />
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
                  {money(dashboard.payment_balance)} · incluye provisionales
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
                <div key={x.id} className="flex justify-between text-sm py-3">
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
            busy ? "Cargando el panel…" : "Conecta la API y actualiza el panel."
          }
        />
      )}
    </>
  );
}
