import { RefreshCw } from "lucide-react";
import { Card } from "../../components/ui";
import type { Alert } from "../../types";
import AlertTable from "./components/AlertTable";
type Props = {
  alerts: Alert[];
  isAdmin: boolean;
  busy: boolean;
  load: () => Promise<void>;
  openCase: (id: number) => Promise<void>;
};
export default function AlertsPage({
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
          <p className="eyebrow">Plazos y obligaciones</p>
          <h1>Alertas y vencimientos</h1>
          <p>
            Avisos a los 5, 3 y 1 días hábiles antes del vencimiento, de lunes a
            viernes.
          </p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>
      <p className="notice">
        Leer descarta este aviso. Marcar atendido completa la obligación legal.
        Los avisos de pago se resuelven al registrar el abono.
      </p>
      <Card>
        <AlertTable
          data={alerts}
          isAdmin={isAdmin}
          busy={busy}
          load={load}
          openCase={openCase}
        />
      </Card>
    </>
  );
}
