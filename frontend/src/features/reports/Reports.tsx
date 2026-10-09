import { RefreshCw } from "lucide-react";
import { Card, Empty } from "../../components/ui";
import type { Report, ReportTotals } from "../../types";
import { money } from "../../utils/format";
type Props = {
  report?: Report;
  isAdmin: boolean;
  busy: boolean;
  load: () => Promise<void>;
};
function metrics(value: ReportTotals, isAdmin: boolean) {
  return (
    <>
      <td>{value.total_cases}</td>
      <td>{value.active_cases}</td>
      <td>{value.concluded_cases}</td>
      {isAdmin && (
        <>
          <td>{money(value.fee)}</td>
          <td>{money(value.paid)}</td>
          <td>{money(value.balance)}</td>
        </>
      )}
    </>
  );
}
export default function Reports({ report, isAdmin, busy, load }: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Métricas del estudio</p>
          <h1>Reportes</h1>
          <p>Casos y resultados agrupados por Rama del Derecho.</p>
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
      <Card>
        {report ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rama del Derecho</th>
                  <th>Total casos</th>
                  <th>Activos</th>
                  <th>Concluidos</th>
                  {isAdmin && (
                    <>
                      <th>Total facturado</th>
                      <th>Efectivo cobrado</th>
                      <th>Saldo pendiente</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.area}>
                    <td>{row.area}</td>
                    {metrics(row, isAdmin)}
                  </tr>
                ))}
                <tr className="totals-row">
                  <td>Total</td>
                  {metrics(report.totals, isAdmin)}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            text={
              busy ? "Cargando reportes…" : "No hay información para mostrar."
            }
          />
        )}
        {isAdmin && (
          <p className="muted text-sm mt-5 mb-0">
            Saldo pendiente = honorarios pactados − abonos registrados.
          </p>
        )}
      </Card>
    </>
  );
}
