import { Field, Form } from "../../../components/ui";
import { financeService } from "../../../services/finance";
import type { Installment } from "../../../types";
import { str } from "../../../utils/form";
import { dateLabel, money } from "../../../utils/format";

type Props = {
  caseId: number;
  quotas: Installment[];
  restore?: boolean;
  done: () => Promise<void>;
};
export default function CollectionForm({
  caseId,
  quotas,
  restore = false,
  done,
}: Props) {
  const available = quotas.filter(
    (quota) =>
      Number(quota.balance) > 0 && !!quota.uncollectible_reason === restore,
  );
  return (
    <Form
      label={
        restore
          ? "Reactivar cuotas seleccionadas"
          : "Marcar cuotas seleccionadas"
      }
      submit={async (form) => {
        const ids = form.getAll("installment_ids").map(Number);
        if (
          !ids.length ||
          ids.some((id) => !available.some((quota) => quota.id === id))
        )
          throw new Error("Selecciona al menos una cuota disponible.");
        const reason = str(form, "reason").trim();
        if (!restore && !reason)
          throw new Error("Indica el motivo de incobrabilidad.");
        await financeService.updateCollections(
          caseId,
          ids,
          restore ? null : reason,
        );
        await done();
      }}
    >
      <p className="full notice">
        {restore
          ? "Selecciona las cuotas cuya cobranza deseas reactivar. Su importe pendiente volverá a sumarse al saldo exigible y podrán recibir abonos y alertas."
          : "Selecciona las cuotas que ya no se pueden cobrar. Su importe pendiente se descontará del saldo exigible; el historial y los abonos se conservan."}
      </p>
      <div className="full table-wrap">
        <table>
          <thead>
            <tr>
              <th>Seleccionar</th>
              <th>Cuota</th>
              <th>Vencimiento</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {available.map((quota) => (
              <tr key={quota.id}>
                <td>
                  <input
                    type="checkbox"
                    name="installment_ids"
                    value={quota.id}
                    aria-label={`Seleccionar cuota ${quota.number}`}
                  />
                </td>
                <td>
                  Cuota {quota.number}
                  {quota.event_name && <small>{quota.event_name}</small>}
                  {restore && <small>{quota.uncollectible_reason}</small>}
                </td>
                <td>{dateLabel(quota.due_date)}</td>
                <td>{money(quota.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!restore && (
        <div className="full">
          <Field label="Motivo de incobrabilidad de las cuotas seleccionadas">
            <textarea name="reason" maxLength={500} required rows={3} />
          </Field>
        </div>
      )}
    </Form>
  );
}
