import { useState } from "react";
import { Field, Form } from "../../../components/ui";
import { financeService } from "../../../services/finance";
import type { Case } from "../../../types";
import { str } from "../../../utils/form";
import { localDate, money } from "../../../utils/format";
import { automaticAllocations } from "../models/paymentAllocation";
type Props = { item: Case; done: () => Promise<void> };
export default function PaymentForm({ item, done }: Props) {
  const [amount, setAmount] = useState("");
  const [firstQuota, setFirstQuota] = useState("");
  const quotas = (item.installments || []).filter(
    (quota) => Number(quota.balance) > 0,
  );
  const ordered = firstQuota
    ? [
        ...quotas.filter((quota) => quota.id === Number(firstQuota)),
        ...quotas.filter((quota) => quota.id !== Number(firstQuota)),
      ].map((quota, index) => ({ ...quota, number: index + 1 }))
    : quotas;
  const applications = automaticAllocations(amount, ordered);
  return (
    <Form
      label="Registrar abono"
      submit={async (form) => {
        await financeService.recordPayment(item.id, {
          payment_date: str(form, "payment_date"),
          amount,
          method: str(form, "method"),
          ...(firstQuota ? { installment_id: Number(firstQuota) } : {}),
        });
        await done();
      }}
    >
      <Field label="Fecha de abono">
        <input
          name="payment_date"
          type="date"
          defaultValue={localDate()}
          required
        />
      </Field>
      <Field label="Importe recibido S/">
        <input
          name="amount"
          type="number"
          min="0.01"
          max={item.balance || undefined}
          step="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      <div className="full">
        <Field label="Medio de pago (opcional)">
          <input
            name="method"
            maxLength={80}
            placeholder="Efectivo, transferencia, Yape…"
          />
        </Field>
      </div>
      <div className="full">
        <Field label="Aplicar primero a">
          <select
            value={firstQuota}
            onChange={(e) => setFirstQuota(e.target.value)}
          >
            <option value="">Automático · primera cuota pendiente</option>
            {quotas.map((quota) => (
              <option value={quota.id} key={quota.id}>
                Cuota {quota.number} · saldo {money(quota.balance)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <p className="full notice">
        El abono cubre primero la cuota pendiente elegida. El excedente pasa a
        las siguientes cuotas en orden.
      </p>
      {amount && (
        <div className="full payment-preview">
          <strong>Así se aplicará el abono</strong>
          {quotas
            .filter((quota) => applications[quota.id])
            .map((quota) => (
              <p key={quota.id}>
                Cuota {quota.number}
                <span>{money(applications[quota.id])}</span>
              </p>
            ))}
          <p className="muted">Saldo total pendiente: {money(item.balance)}</p>
        </div>
      )}
    </Form>
  );
}
