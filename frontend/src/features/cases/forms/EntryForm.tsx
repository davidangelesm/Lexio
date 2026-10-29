import { Field, Form } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Entry, Installment, User } from "../../../types";
import type { EntryInput } from "../../../types/requests";
import { str } from "../../../utils/form";
import { dateTimeLabels, localDate } from "../../../utils/format";
type Props = {
  caseId: number;
  actor: User;
  item?: Entry;
  installments?: Installment[];
  done: () => Promise<void>;
};
export default function EntryForm({
  caseId,
  actor,
  item,
  installments = [],
  done,
}: Props) {
  const registered = item && dateTimeLabels(item.created_at);
  const events = installments.filter(
    (quota) =>
      quota.event_name &&
      (!quota.entry_id || quota.entry_id === item?.id) &&
      (!quota.activated_at || quota.id === item?.payment_installment_id),
  );
  return (
    <Form
      label={item ? "Guardar cambios" : "Registrar actuación"}
      submit={async (form) => {
        const alertDate = str(form, "alert_date") || null;
        const alertTime = str(form, "alert_time") || null;
        if (alertTime && !alertDate)
          throw new Error(
            "Indica la fecha de alerta para programar una hora de audiencia.",
          );
        const data: EntryInput = {
          action_date: str(form, "action_date"),
          subject: str(form, "subject"),
          subject_type: str(form, "subject_type") === "otro" ? "otro" : "legal",
          description: str(form, "description"),
          alert_date: alertDate,
          ...(alertTime || item?.alert_time
            ? { alert_time: alertDate ? alertTime : null }
            : {}),
        };
        if (
          actor.role === "admin" &&
          (events.length || item?.payment_installment_id)
        ) {
          data.payment_installment_id = item?.attended
            ? (item.payment_installment_id ?? null)
            : Number(str(form, "payment_installment_id")) || null;
        }
        if (item) await casesService.updateEntry(item.id, data);
        else await casesService.addEntry(caseId, data);
        await done();
      }}
    >
      <Field label="Fecha de actuación">
        <input
          name="action_date"
          type="date"
          required
          defaultValue={item?.action_date || localDate()}
        />
      </Field>
      <Field label="Fecha de alerta (opcional)">
        <input
          name="alert_date"
          type="date"
          defaultValue={item?.alert_date || ""}
        />
      </Field>
      <Field label="Hora de alerta / audiencia (opcional)">
        <input
          name="alert_time"
          type="time"
          defaultValue={item?.alert_time || ""}
        />
      </Field>
      <Field label="Asunto">
        <input
          name="subject"
          required
          maxLength={150}
          placeholder="Resumen breve de la actuación"
          defaultValue={item?.subject}
        />
      </Field>
      <Field label="Tipo de asunto">
        <select
          name="subject_type"
          required
          defaultValue={item?.subject_type || "legal"}
        >
          <option value="legal">Legal</option>
          <option value="otro">Otro</option>
        </select>
      </Field>
      <div className="full">
        <Field label="Descripción detallada">
          <textarea
            name="description"
            required
            maxLength={10000}
            placeholder="Describe la actuación realizada…"
            defaultValue={item?.description}
          />
        </Field>
      </div>
      {actor.role === "admin" && events.length > 0 && (
        <div className="full rounded-xl border border-[#bfcfc8] bg-[#f4f8f6] p-5">
          <Field label="Cuota por evento vinculada (opcional)">
            <select
              name="payment_installment_id"
              defaultValue={item?.payment_installment_id || ""}
              disabled={item?.attended}
            >
              <option value="">Sin cuota vinculada</option>
              {events.map((quota) => (
                <option key={quota.id} value={quota.id}>
                  Cuota {quota.number} · {quota.event_name}
                </option>
              ))}
            </select>
          </Field>
          <p className="muted mt-3 mb-0 text-sm">
            La cuota vence en la fecha de alerta de esta actuación y genera
            recordatorios de cobro a 5, 3 y 1 días hábiles. Si cambias esa fecha,
            el vencimiento de la cuota se actualiza. Sin fecha de alerta, queda
            esperando fecha.
          </p>
        </div>
      )}
      {item && registered ? (
        <p className="full notice">
          Responsable: {item.responsible_name}.
          <br />
          Registro original: {registered.date} · {registered.time}.
        </p>
      ) : (
        <p className="full notice">
          Responsable: {actor.name}. La fecha y hora de registro se guardan
          automáticamente.
        </p>
      )}
      {item?.attended && (
        <p className="full muted text-sm">Este asunto ya está atendido.</p>
      )}
    </Form>
  );
}
