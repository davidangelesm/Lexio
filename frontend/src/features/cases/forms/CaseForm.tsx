import { useState } from "react";
import { Field, Form } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Case, Client, LegalArea, User } from "../../../types";
import type { CaseInput, InstallmentInput } from "../../../types/requests";
import { str } from "../../../utils/form";
import { localDate, money } from "../../../utils/format";
import AreaSelect from "../components/AreaSelect";
type Props = {
  actor: User;
  users: User[];
  clients: Client[];
  areas: LegalArea[];
  item?: Case;
  clientId?: number;
  saved: (item: Case) => void;
};
const cents = (value: string) => {
  if (!/^\d+(?:\.\d{0,2})?$/.test(value)) return 0n;
  const [whole, part = ""] = value.split(".");
  return BigInt(whole) * 100n + BigInt(part.padEnd(2, "0"));
};
export default function CaseForm({
  actor,
  users,
  clients,
  areas,
  item,
  clientId,
  saved,
}: Props) {
  const isAdmin = actor.role === "admin";
  const hasPayments = !!item?.payments?.length;
  const [fee, setFee] = useState(item?.fee || "");
  const [plan, setPlan] = useState<InstallmentInput[]>(
    item?.installments?.length
      ? item.installments.map((quota) => ({
          id: quota.id,
          amount: quota.amount,
          due_date: quota.due_date,
        }))
      : [{ amount: item?.fee || "", due_date: localDate() }],
  );
  const planTotal = plan.reduce(
    (total, quota) => total + cents(quota.amount),
    0n,
  );
  function changeQuota(index: number, change: Partial<InstallmentInput>) {
    setPlan((current) =>
      current.map((quota, position) =>
        position === index ? { ...quota, ...change } : quota,
      ),
    );
  }
  return (
    <Form
      label={item ? "Guardar cambios" : "Crear caso"}
      submit={async (form) => {
        const selectedArea = Number(str(form, "area_id"));
        if (!areas.some((area) => area.id === selectedArea))
          throw new Error(
            areas.length
              ? "Selecciona una rama del catálogo."
              : "El administrador debe configurar el catálogo de ramas antes de registrar o editar casos.",
          );
        const data: Omit<CaseInput, "client_id"> = {
          area_id: selectedArea,
          process_type: str(form, "process_type"),
          initial_stage: str(form, "initial_stage"),
          status: str(form, "status") as CaseInput["status"],
        };
        if (isAdmin) {
          data.responsible_id = Number(str(form, "responsible_id"));
          const installments = plan.map((quota, index) => ({
            ...quota,
            amount: str(form, `amount_${index}`),
            due_date: str(form, `due_date_${index}`),
          }));
          const total = installments.reduce(
            (sum, quota) => sum + cents(quota.amount),
            0n,
          );
          const honorarios = str(form, "fee");
          if (total !== cents(honorarios))
            throw new Error(
              "La suma de las cuotas debe ser igual a los honorarios.",
            );
          if (!hasPayments) data.fee = honorarios;
          data.installments = installments;
        }
        if (item) saved(await casesService.update(item.id, data));
        else {
          const selectedClient = Number(str(form, "client_id"));
          if (!selectedClient)
            throw new Error("Selecciona un cliente ya registrado.");
          saved(
            await casesService.create({ ...data, client_id: selectedClient }),
          );
        }
      }}
    >
      {item ? (
        <p className="full notice">
          {item.client.code} · {item.client.name}
        </p>
      ) : (
        <div className="full">
          <Field label="Cliente">
            <select name="client_id" defaultValue={clientId || ""} required>
              <option value="">Selecciona un cliente</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.code} · {client.name}
                </option>
              ))}
            </select>
          </Field>
          {!clients.length && (
            <p className="notice mt-3">
              Primero registra al cliente en la página Clientes.
            </p>
          )}
        </div>
      )}
      <div className="full form-section">
        <h3>Tipo de proceso</h3>
      </div>
      <Field label="Rama del Derecho">
        <AreaSelect
          name="area_id"
          areas={areas}
          defaultValue={item?.area_id}
          required
        />
      </Field>
      <Field label="Tipo de proceso">
        <input
          name="process_type"
          required
          maxLength={150}
          defaultValue={item?.process_type}
          placeholder="Ej. Divorcio, cobro de deuda…"
        />
      </Field>
      <Field label="Etapa en que se recibe el proceso">
        <input
          name="initial_stage"
          required
          maxLength={100}
          defaultValue={item?.initial_stage}
          placeholder="Ej. Demanda, apelación…"
        />
      </Field>
      <Field label="Estado del proceso">
        <select name="status" defaultValue={item?.status || "activo"}>
          <option value="activo">Activo</option>
          <option value="concluido">Concluido</option>
        </select>
      </Field>
      {isAdmin && (
        <div className="full">
          <Field label="Abogado responsable">
            <select
              name="responsible_id"
              defaultValue={item?.responsible_id || actor.id}
            >
              {users
                .filter(
                  (user) => user.active || user.id === item?.responsible_id,
                )
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
          </Field>
        </div>
      )}
      {isAdmin && (
        <>
          <div className="full form-section">
            <h3>Control financiero</h3>
            <p>
              Indica el total pactado y las fechas de vencimiento de sus cuotas.
            </p>
          </div>
          <Field label="Honorarios totales S/">
            <input
              name="fee"
              type="number"
              min="0.01"
              step="0.01"
              required
              value={fee}
              readOnly={hasPayments}
              onChange={(event) => {
                const value = event.target.value;
                setFee(value);
                if (plan.length === 1) changeQuota(0, { amount: value });
              }}
            />
          </Field>
          <p className="muted self-center">
            Total de cuotas: {money(Number(planTotal) / 100)}
          </p>
          {hasPayments && (
            <p className="full notice">
              Ya hay abonos registrados. Puedes cambiar los vencimientos; los
              honorarios y montos se conservan.
            </p>
          )}
          <div className="full">
            {plan.map((quota, index) => (
              <div className="plan-row" key={quota.id || index}>
                <Field label={`Cuota ${index + 1} · importe S/`}>
                  <input
                    name={`amount_${index}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={quota.amount}
                    readOnly={hasPayments}
                    onChange={(event) =>
                      changeQuota(index, { amount: event.target.value })
                    }
                  />
                </Field>
                <Field label="Fecha de vencimiento">
                  <input
                    name={`due_date_${index}`}
                    type="date"
                    required
                    value={quota.due_date}
                    onChange={(event) =>
                      changeQuota(index, { due_date: event.target.value })
                    }
                  />
                </Field>
                {!hasPayments && plan.length > 1 && (
                  <button
                    className="secondary"
                    type="button"
                    onClick={() =>
                      setPlan((current) =>
                        current.filter((_, position) => position !== index),
                      )
                    }
                  >
                    Quitar cuota
                  </button>
                )}
              </div>
            ))}
            {!hasPayments && (
              <button
                className="secondary"
                type="button"
                onClick={() =>
                  setPlan((current) => [
                    ...current,
                    { amount: "", due_date: localDate() },
                  ])
                }
              >
                Agregar cuota
              </button>
            )}
          </div>
        </>
      )}
    </Form>
  );
}
