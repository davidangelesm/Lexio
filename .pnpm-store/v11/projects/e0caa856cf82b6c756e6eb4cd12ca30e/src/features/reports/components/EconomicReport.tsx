import { Badge, Card } from "../../../components/ui/index";
import { dateLabel, money } from "../../../utils/format";
import type { ReportsState } from "../hooks/useReports";

type Props = Pick<ReportsState, "tab" | "openCase"> & {
  economic: NonNullable<ReportsState["economic"]>;
};
export default function EconomicReport({ economic, tab, openCase }: Props) {
  return (
    <>
      <p className="notice">
        Corte: {dateLabel(economic.cutoff)}. Se usan los registros vigentes, las
        contrataciones y abonos hasta el corte. Las condiciones de eventos y
        reversiones reflejan su revisión actual.
      </p>
      <div className="stats">
        {(
          [
            ["contracted", "Contratado"],
            ["applied", "Cobrado aplicado"],
            ["balance", "Saldo por cobrar"],
            ["overdue", "Vencido"],
            ["not_due", "No vencido"],
            ["pending_event", "Pendiente de evento"],
            ["credit", "Crédito sin aplicar"],
          ] as const
        ).map(([k, l]) => (
          <Card className="stat" key={k}>
            <p>{l}</p>
            <strong className="!text-xl">{money(economic.totals[k])}</strong>
          </Card>
        ))}
      </div>
      {tab === "economico" && (
        <Card>
          <h2>Vista gerencial por rama</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Área</th>
                  <th>Casos</th>
                  <th>Activos</th>
                  <th>Concluidos</th>
                  <th>Suspendidos</th>
                  <th>Contratado</th>
                  <th>Cobrado aplicado</th>
                  <th>Saldo</th>
                  <th>Vencido</th>
                  <th>No vencido</th>
                  <th>Pend. evento</th>
                </tr>
              </thead>
              <tbody>
                {economic.areas.map((x) => (
                  <tr key={x.area}>
                    <td>{x.area}</td>
                    <td>{x.total}</td>
                    <td>{x.activo}</td>
                    <td>{x.concluido}</td>
                    <td>{x.suspendido}</td>
                    {(
                      [
                        "contracted",
                        "applied",
                        "balance",
                        "overdue",
                        "not_due",
                        "pending_event",
                      ] as const
                    ).map((k) => (
                      <td key={k}>{money(x[k])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {economic.services.map((s) => (
        <Card key={s.id}>
          <div className="card-head">
            <div>
              <h2>
                {s.client?.name} · {s.scope}
              </h2>
              <small>
                {s.client?.code} · Servicio {s.id} · {money(s.fee)}
              </small>
            </div>
            <button className="link-button" onClick={() => openCase(s.case_id)}>
              {s.case_code}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cuota / condición</th>
                  <th>Vencimiento</th>
                  <th>Monto</th>
                  <th>Abonado</th>
                  <th>Saldo</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {s.installments?.map((x) => (
                  <tr key={x.id}>
                    <td>
                      Cuota {x.number}
                      <small>
                        {x.condition}{" "}
                        {x.event_id ? `· evento ${x.event_id}` : ""}
                      </small>
                      {x.payments.map((p) => (
                        <small key={p.id}>
                          {dateLabel(p.payment_date)} ·{" "}
                          {money(p.applied_amount)}{" "}
                          {p.reversed_at ? "· reversado" : ""}
                        </small>
                      ))}
                    </td>
                    <td>{dateLabel(x.due_date)}</td>
                    <td>{money(x.amount)}</td>
                    <td>{money(x.paid)}</td>
                    <td>{money(x.balance)}</td>
                    <td>
                      <Badge>{x.state}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </>
  );
}
