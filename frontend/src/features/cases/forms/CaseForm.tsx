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
  users?: User[];
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
  const availableLawyers = users?.length
    ? users.filter((u) => u.active || u.id === item?.responsible_id)
    : [actor];
  const quotaLocked = (quota: InstallmentInput) =>
    item?.installments?.some(
      (original) =>
        original.id === quota.id &&
        (cents(original.paid) > 0n || !!original.uncollectible_reason),
    ) ?? false;
  const [fee, setFee] = useState(item?.fee || "");
  const [clientRows, setClientRows] = useState<string[]>(
    item?.clients?.length
      ? item.clients.map((c) => String(c.id))
      : item?.client
        ? [String(item.client.id)]
        : [clientId ? String(clientId) : ""],
  );
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
        const responsibleId = Number(str(form, "responsible_id"));
        const data: Omit<CaseInput, "client_id"> = {
          area_id: selectedArea,
          process_type: str(form, "process_type"),
          ...(form.has("tracking_number")
            ? { tracking_number: str(form, "tracking_number") }
            : {}),
          initial_stage: str(form, "initial_stage"),
          status: str(form, "status") as CaseInput["status"],
          ...(responsibleId > 0 ? { responsible_id: responsibleId } : {}),
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
        const rawClients = [
          str(form, "client_id"),
          ...form.getAll("client_ids").map((val) => String(val).trim()),
        ].filter(Boolean);
        const selectedClients = [
          ...new Set(rawClients.map(Number).filter((id) => id > 0)),
        ];
        if (item) {
          const originalIds =
            item.clients?.map((c) => c.id) ?? [item.client.id];
          const changedClients =
            selectedClients.length > 0 &&
            (selectedClients.length !== originalIds.length ||
              selectedClients.some((id, idx) => id !== originalIds[idx]));
          saved(
            await casesService.update(item.id, {
              ...data,
              ...(changedClients ? { client_ids: selectedClients } : {}),
            }),
          );
        } else {
          if (!selectedClients.length)
            throw new Error("Selecciona un cliente ya registrado.");
          saved(
            await casesService.create({
              ...data,
              client_id: selectedClients[0],
              ...(selectedClients.length > 1
                ? { client_ids: selectedClients }
                : {}),
            }),
          );
        }
      }}
    >
      <div className="full">
        <div className="client-multi-list">
          {clientRows.map((selectedId, index) => (
            <div className="client-multi-row" key={`client-row-${index}`}>
              <Field
                label={
                  index === 0
                    ? "Cliente principal"
                    : `Cliente adicional ${index}`
                }
              >
                <select
                  name={index === 0 ? "client_id" : "client_ids"}
                  defaultValue={selectedId}
                  required={index === 0 && !item}
                  onChange={(event) => {
                    const nextVal = event.target.value;
                    setClientRows((current) =>
                      current.map((val, pos) =>
                        pos === index ? nextVal : val,
                      ),
                    );
                  }}
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.document_number} · {client.name}
                    </option>
                  ))}
                </select>
              </Field>
              {clientRows.length > 1 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setClientRows((current) =>
                      current.filter((_, pos) => pos !== index),
                    )
                  }
                >
                  Quitar cliente
                </button>
              )}
            </div>
          ))}
          {clients.length > 1 && (
            <button
              type="button"
              className="secondary mt-2"
              onClick={() => setClientRows((current) => [...current, ""])}
            >
              Agregar otro cliente al caso
            </button>
          )}
        </div>
        {!clients.length && !item && (
          <p className="notice mt-3">
            Primero registra al cliente en la página Clientes.
          </p>
        )}
      </div>
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
      <Field label="Expediente / Número de seguimiento">
        <input
          name="tracking_number"
          maxLength={100}
          defaultValue={item?.tracking_number || ""}
          placeholder="Ej. 01234-2026-0-1801-JR-CI-01"
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
      <Field label="Abogado responsable">
        <select
          name="responsible_id"
          defaultValue={item?.responsible_id ?? actor.id}
        >
          {availableLawyers.map((lawyer) => (
            <option key={lawyer.id} value={lawyer.id}>
              {lawyer.name}
            </option>
          ))}
        </select>
      </Field>
      {isAdmin && (
        <>
          <div className="full form-section">
            <h3>Control financiero</h3>
            <p>
              Indica el total pactado y si cada cuota vence en una fecha fija o
              en la fecha de alerta de una actuación vinculada a un evento.
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
                  <Field label="Evento / hito del pago">
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
                        ? `Vencimiento: ${quota.due_date}`
                        : "Vincula una actuación con fecha de alerta en Bitácora para programar el cobro."}
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
