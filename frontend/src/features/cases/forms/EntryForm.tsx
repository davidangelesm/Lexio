import { Field, Form } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Entry, User } from "../../../types";
import type { EntryInput } from "../../../types/requests";
import { str } from "../../../utils/form";
import { dateTimeLabels, localDate } from "../../../utils/format";
type Props = {
  caseId: number;
  actor: User;
  item?: Entry;
  done: () => Promise<void>;
};
export default function EntryForm({ caseId, actor, item, done }: Props) {
  const registered = item && dateTimeLabels(item.created_at);
  return (
    <Form
      label={item ? "Guardar cambios" : "Registrar actuación"}
      submit={async (form) => {
        const data: EntryInput = {
          action_date: str(form, "action_date"),
          subject: str(form, "subject"),
          subject_type: str(form, "subject_type") === "otro" ? "otro" : "legal",
          description: str(form, "description"),
          alert_date: str(form, "alert_date") || null,
        };
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
