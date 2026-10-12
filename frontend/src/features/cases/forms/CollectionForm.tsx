import { Field, Form } from "../../../components/ui";
import { financeService } from "../../../services/finance";
import type { Installment } from "../../../types";
import { str } from "../../../utils/form";
import { money } from "../../../utils/format";

type Props = { quota: Installment; done: () => Promise<void> };
export default function CollectionForm({ quota, done }: Props) {
  const restore = !!quota.uncollectible_reason;
  return (
    <Form
      label={restore ? "Reactivar cobranza" : "Marcar incobrable"}
      submit={async (form) => {
        const reason = str(form, "reason").trim();
        if (!restore && !reason)
          throw new Error("Indica el motivo de incobrabilidad.");
        await financeService.updateCollection(
          quota.id,
          restore ? null : reason,
        );
        await done();
      }}
    >
      <p className="full notice">
        Cuota {quota.number} · saldo {money(quota.balance)}.
        {restore
          ? " Su importe pendiente volverá a sumarse al saldo exigible, recibirá alertas de cobranza y podrá registrar abonos."
          : " El importe pendiente se descontará del saldo exigible. El historial y los abonos se conservan. La cuota dejará de generar alertas y de recibir abonos hasta que reactive la cobranza."}
      </p>
      {restore ? (
        <p className="full">Motivo registrado: {quota.uncollectible_reason}</p>
      ) : (
        <div className="full">
          <Field label="Motivo de incobrabilidad">
            <textarea name="reason" maxLength={500} required rows={3} />
          </Field>
        </div>
      )}
    </Form>
  );
}
