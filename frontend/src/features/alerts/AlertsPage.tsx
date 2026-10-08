import { RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../../components/ui/index";
import type { LexioState } from "../../hooks/useLexio";
import type { Alert } from "../../types/index";

type Props = Pick<LexioState, "busy" | "load" | "alerts"> & {
  alertTable: (data: Alert[]) => ReactNode;
};
export default function AlertsPage({ busy, load, alertTable, alerts }: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Seguimiento del estudio</p>
          <h1>Centro de alertas</h1>
          <p>
            Leído descarta un aviso. Atendido completa la tarea y retira sus
            alertas. Las tareas pendientes después del vencimiento son urgentes.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={14} />
          Actualizar
        </button>
      </div>
      <Card>{alertTable(alerts)}</Card>
    </>
  );
}
