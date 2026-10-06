import { Field, Form } from "../../../components/ui/index";
import { financeService } from "../../../services/finance";
import { str } from "../../../utils/form";
import { dateLabel, localDate, money } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "allocations" | "modal" | "paymentId" | "done" | "setAllocations"
> & { service: NonNullable<CaseWorkspaceState["service"]> };
export default function PaymentForm({
  allocations,
  modal,
  paymentId,
  service,
  done,
  setAllocations,
}: Props) {
  return (
    <Form
      submit={async (f) => {
        const applications = Object.entries(allocations)
          .filter(([, v]) => Number(v) > 0)
          .map(([k, v]) => ({ installment_id: Number(k), amount: v }));
        if (modal === "credito")
          await financeService.applyCredit(paymentId, {
            applications,
          });
        else
          await financeService.recordPayment(service.id, {
            payment_date: str(f, "payment_date"),
            amount: str(f, "amount"),
            method: str(f, "method"),
            receipt: str(f, "receipt"),
            observation: str(f, "observation"),
            applications,
          });
        await done();
      }}
    >
      {modal === "abono" && (
        <>
          <Field label="Fecha de abono">
            <input
              type="date"
              name="payment_date"
              required
              max={localDate()}
              defaultValue={localDate()}
            />
          </Field>
          <Field label="Importe recibido S/">
            <input
              type="number"
              name="amount"
              required
              min="0.01"
              step="0.01"
            />
          </Field>
          <Field label="Medio de pago">
            <input
              name="method"
              required
              placeholder="Transferencia, efectivo, Yape…"
            />
          </Field>
          <Field label="Comprobante (referencia opcional)">
            <input name="receipt" />
          </Field>
          <div className="full">
            <Field label="Observación">
              <textarea name="observation" />
            </Field>
          </div>
        </>
      )}
      <div className="full">
        <p className="notice">
          Distribuye el abono entre cuotas. La lista propone primero la cuota
          exigible más antigua. Lo recibido sin aplicar queda como crédito
          separado.
        </p>
        {service.installments
          ?.filter((x) => Number(x.balance) > 0)
          .map((x) => (
            <div className="flex gap-4 items-center py-2" key={x.id}>
              <span className="text-sm flex-1">
                Cuota {x.number} · {money(x.balance)} · {dateLabel(x.due_date)}
              </span>
              <input
                className="max-w-36"
                type="number"
                step="0.01"
                min="0"
                max={x.balance}
                aria-label={`Aplicar a cuota ${x.number}`}
                value={allocations[x.id] || ""}
                onChange={(e) =>
                  setAllocations({
                    ...allocations,
                    [x.id]: e.target.value,
                  })
                }
              />
            </div>
          ))}
      </div>
    </Form>
  );
}
