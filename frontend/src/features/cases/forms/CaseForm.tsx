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
  clients,
  areas,
  item,
  clientId,
  saved,
}: Props) {
  const isAdmin = actor.role === "admin";
  const quotaLocked = (quota: InstallmentInput) =>
    item?.installments?.some(
      (original) => original.id === quota.id && cents(original.paid) > 0n,
    ) ?? false;
  const [fee, setFee] = useState(item?.fee || "");
  const [plan, setPlan] = useState<InstallmentInput[]>(
    item?.installments?.length
      ? item.installments.map((quota) => ({
          id: quota.id,
          amount: quota.amount,
          due_date: quota.due_date,
          ...(quota.event_name != null ? { event_name: quota.event_name } : {}),
        }))
      : [{ amount: item?.fee || "", due_date: localDate() }],
  );
  const planTotal = plan.reduce(
    (total, quota) => total + cents(quota.amount),
    0n,
  );
  const quotaNumber = (quota: InstallmentInput, index: number) =>
    item?.installments?.find((original) => original.id === quota.id)?.number ??
    Math.max(
      0,
      ...(item?.installments?.map((original) => original.number) ?? []),
    ) + plan.slice(0, index + 1).filter((row) => row.id == null).length;
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
          const installments = plan.map((quota, index) => ({
            ...quota,
            amount: str(form, `amount_${index}`),
            due_date:
              quota.event_name != null
                ? quota.due_date
                : str(form, `due_date_${index}`),
            ...(quota.event_name != null
              ? { event_name: str(form, `event_name_${index}`).trim() }
              : {}),
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
          data.fee = honorarios;
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
          <option value="retirado">Retirado</option>
        </select>
      </Field>
      {isAdmin && (
        <>
          <div className="full form-section">
            <h3>Control financiero</h3>
            <p>
              Indica el total pactado y si cada cuota se paga por fecha o al
              cumplir un evento.
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
              onChange={(event) => {
                const value = event.target.value;
                setFee(value);
                if (plan.length === 1 && !quotaLocked(plan[0]))
                  changeQuota(0, { amount: value });
              }}
            />
          </Field>
          <p className="muted self-center">
            Total de cuotas: {money(Number(planTotal) / 100)}
          </p>
          {item && (
            <p className="full notice">
              Solo las cuotas que recibieron abonos están bloqueadas. Puedes
              modificar las demás y ajustar los honorarios al nuevo total.
              Cambiar el evento o pasar a fecha desvincula la actuación
              anterior.
            </p>
          )}
          <div className="full">
            {plan.map((quota, index) => (
              <div
                className="plan-row"
                key={quota.id != null ? `saved-${quota.id}` : `new-${index}`}
              >
                <Field
                  label={`Cuota ${quotaNumber(quota, index)} · importe S/`}
                >
                  <input
                    name={`amount_${index}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={quota.amount}
                    readOnly={quotaLocked(quota)}
                    onChange={(event) =>
                      changeQuota(index, { amount: event.target.value })
                    }
                  />
                </Field>
                <Field label="Se paga por">
                  <select
                    value={quota.event_name != null ? "evento" : "fecha"}
                    disabled={quotaLocked(quota)}
                    onChange={(event) =>
                      changeQuota(
                        index,
                        event.target.value === "evento"
                          ? { event_name: "", due_date: null }
                          : { event_name: undefined, due_date: localDate() },
                      )
                    }
                  >
                    <option value="fecha">Fecha</option>
                    <option value="evento">Evento / hito</option>
                  </select>
                </Field>
                {quota.event_name != null ? (
                  <Field label="Evento que activa el pago">
                    <input
                      name={`event_name_${index}`}
                      required
                      maxLength={150}
                      value={quota.event_name}
                      readOnly={quotaLocked(quota)}
                      placeholder="Ej. Sentencia favorable"
                      onChange={(event) =>
                        changeQuota(index, {
                          event_name: event.target.value,
                          due_date: null,
                        })
                      }
                    />
                    <small>
                      {quota.due_date
                        ? `Activado: ${quota.due_date}`
                        : "Vincula una actuación en Bitácora. Se cobra al marcarla como atendida."}
                    </small>
                  </Field>
                ) : (
                  <Field label="Fecha de vencimiento">
                    <input
                      name={`due_date_${index}`}
                      type="date"
                      required
                      value={quota.due_date || ""}
                      readOnly={quotaLocked(quota)}
                      onChange={(event) =>
                        changeQuota(index, { due_date: event.target.value })
                      }
                    />
                  </Field>
                )}
                {!quotaLocked(quota) && plan.length > 1 && (
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
          </div>
        </>
      )}
    </Form>
  );
}
