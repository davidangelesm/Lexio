import { Plus } from "lucide-react";
import { Badge, Card, Empty } from "../../../components/ui/index";
import { financeService } from "../../../services/finance";
import { dateLabel, money } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";
import { newPlan } from "../models/installmentPlan";

type Props = Pick<
  CaseWorkspaceState,
  | "isAdmin"
  | "setPlans"
  | "setPercent"
  | "setModal"
  | "services"
  | "beginPayment"
  | "setQuota"
  | "action"
  | "setService"
  | "setPaymentId"
  | "setAllocations"
>;
export default function CaseServices({
  isAdmin,
  setPlans,
  setPercent,
  setModal,
  services,
  beginPayment,
  setQuota,
  action,
  setService,
  setPaymentId,
  setAllocations,
}: Props) {
  return (
    <>
      <div className="page-head">
        <h2>Alcances contratados</h2>
        {isAdmin && (
          <button
            className="primary"
            onClick={() => {
              setPlans([newPlan()]);
              setPercent(false);
              setModal("servicio");
            }}
          >
            <Plus size={15} />
            Contratar servicio
          </button>
        )}
      </div>
      {!services.length && (
        <Empty text="Las etapas futuras no generan deuda hasta su contratación." />
      )}
      {services.map((s) => (
        <Card key={s.id}>
          <div className="card-head">
            <div>
              <h2>{s.scope}</h2>
              <small>
                {s.stage} · {s.mode} · {dateLabel(s.contract_date)}
              </small>
            </div>
            {isAdmin && (
              <div className="text-right">
                <strong>{money(s.fee)}</strong>
                <br />
                <button
                  className="link-button mt-2"
                  onClick={() => void beginPayment(s)}
                >
                  Registrar abono
                </button>
              </div>
            )}
          </div>
          {isAdmin && (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cuota / condición</th>
                      <th>Vencimiento</th>
                      <th>Monto</th>
                      <th>Aplicado</th>
                      <th>Saldo</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {s.installments?.map((x) => (
                      <tr key={x.id}>
                        <td>
                          Cuota {x.number}
                          <small>
                            {x.condition}
                            {x.event_id
                              ? ` · evento ${x.event_id} · ${x.offset_days} días (${x.day_basis})`
                              : ""}
                          </small>
                          {x.payments?.map((p) => (
                            <small key={p.id}>
                              {dateLabel(p.payment_date)} ·{" "}
                              {money(p.applied_amount)}{" "}
                              {p.reversed_at ? "· reversado" : ""}
                            </small>
                          ))}
                        </td>
                        <td>
                          {dateLabel(x.due_date)}
                          {x.review_required && x.provisional_date && (
                            <small>
                              Provisional: {dateLabel(x.provisional_date)}
                            </small>
                          )}
                        </td>
                        <td>{money(x.amount)}</td>
                        <td>{money(x.paid)}</td>
                        <td>{money(x.balance)}</td>
                        <td>
                          <Badge>{x.state}</Badge>
                        </td>
                        <td>
                          {x.event_id && (
                            <button
                              className="link-button"
                              onClick={() => {
                                setQuota(x);
                                setModal("vincular");
                              }}
                            >
                              Vincular evento
                            </button>
                          )}
                          {x.condition === "fecha" && Number(x.balance) > 0 && (
                            <button
                              className="link-button"
                              onClick={() => {
                                setQuota(x);
                                setModal("reprogramar");
                              }}
                            >
                              Reprogramar
                            </button>
                          )}
                          {x.review_required && (
                            <button
                              className="link-button"
                              onClick={() =>
                                void action(() =>
                                  financeService.confirmInstallment(x.id),
                                )
                              }
                            >
                              Confirmar evento
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h3 className="text-sm mt-5">Abonos vigentes</h3>
              {!s.payments?.length ? (
                <small>Sin abonos.</small>
              ) : (
                s.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex justify-between gap-3 text-sm py-3 border-b border-gray-100"
                  >
                    <span>
                      {dateLabel(p.payment_date)} · {money(p.amount)} ·{" "}
                      {p.method}
                    </span>
                    <div className="actions">
                      <button
                        className="link-button"
                        onClick={() => {
                          setService(s);
                          setPaymentId(p.id);
                          setAllocations({});
                          setModal("credito");
                        }}
                      >
                        Aplicar crédito
                      </button>
                      <button
                        className="link-button"
                        onClick={() => {
                          setPaymentId(p.id);
                          setModal("reversar");
                        }}
                      >
                        Reversar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </Card>
      ))}
    </>
  );
}
