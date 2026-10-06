import { Card } from "../../../components/ui/index";
import { dateLabel, money } from "../../../utils/format";
import type { ReportsState } from "../hooks/useReports";

type Props = Pick<ReportsState, "openCase"> & {
  collections: NonNullable<ReportsState["collections"]>;
};
export default function CollectionsReport({ collections, openCase }: Props) {
  return (
    <>
      <Card>
        <h2>
          Recibido: {money(collections.received)} · crédito sin aplicar:{" "}
          {money(collections.credit)}
        </h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Cliente / caso</th>
                <th>Servicio</th>
                <th>Recibido</th>
                <th>Aplicación</th>
                <th>Crédito</th>
                <th>Medio</th>
              </tr>
            </thead>
            <tbody>
              {collections.payments.map((x) => (
                <tr key={x.id}>
                  <td>{dateLabel(x.payment_date)}</td>
                  <td>
                    <button
                      className="link-button"
                      onClick={() => x.case_id && openCase(x.case_id)}
                    >
                      {x.case_code}
                    </button>
                    <small>{x.client?.name}</small>
                  </td>
                  <td>{x.service_id}</td>
                  <td>
                    {money(x.amount)}
                    {x.reversed_at && <small>Reversado</small>}
                  </td>
                  <td>
                    {x.applications?.map((a) => (
                      <small key={a.installment_id}>
                        Cuota ID {a.installment_id}: {money(a.amount)}
                      </small>
                    ))}
                  </td>
                  <td>{money(x.credit)}</td>
                  <td>{x.method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
