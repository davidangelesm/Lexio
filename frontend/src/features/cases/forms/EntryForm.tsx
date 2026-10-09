import { Field, Form } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Entry, User } from "../../../types";
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
        const data = {
          action_date: str(form, "action_date"),
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
      <Field label="Fecha de alerta legal (opcional)">
        <input
          name="alert_date"
          type="date"
          defaultValue={item?.alert_date || ""}
        />
      </Field>
      <div className="full">
        <Field label="Breve descripción del acto">
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
        <p className="full muted text-sm">Esta obligación ya está atendida.</p>
      )}
    </Form>
  );
}
