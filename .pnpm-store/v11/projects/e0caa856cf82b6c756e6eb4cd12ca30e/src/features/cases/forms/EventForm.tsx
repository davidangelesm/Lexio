import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { num, str } from "../../../utils/form";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "editEvent" | "caseId" | "done" | "entries"
>;
export default function EventForm({ editEvent, caseId, done, entries }: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.saveEvent(caseId, editEvent?.id, {
          description: str(f, "description"),
          entry_id: str(f, "entry_id") ? num(f, "entry_id") : null,
          scheduled_date: str(f, "scheduled_date") || null,
          effective_date: str(f, "effective_date") || null,
          effective_kind: str(f, "effective_kind") || null,
        });
        await done();
      }}
    >
      <div className="full">
        <Field label="Identifica la audiencia, sentencia o acto específico">
          <input
            name="description"
            required
            defaultValue={editEvent?.description}
          />
        </Field>
      </div>
      <Field label="Fecha programada (opcional)">
        <input
          type="date"
          name="scheduled_date"
          defaultValue={editEvent?.scheduled_date || ""}
        />
      </Field>
      <Field label="Actuación de origen">
        <select name="entry_id" defaultValue={editEvent?.entry_id || ""}>
          <option value="">Sin actuación</option>
          {entries.map((x) => (
            <option key={x.id} value={x.id}>
              {x.description.slice(0, 65)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Condición efectiva">
        <select
          name="effective_kind"
          defaultValue={editEvent?.effective_kind || ""}
        >
          <option value="">Todavía pendiente</option>
          {["realizacion", "emision", "notificacion"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Fecha efectiva">
        <input
          type="date"
          name="effective_date"
          defaultValue={editEvent?.effective_date || ""}
        />
      </Field>
      <p className="full notice">
        Cambiar el evento requiere una nueva confirmación de David en las cuotas
        vinculadas.
      </p>
    </Form>
  );
}
