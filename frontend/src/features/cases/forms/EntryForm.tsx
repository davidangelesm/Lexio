import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { str } from "../../../utils/form";
import { localDate } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "editEntry" | "caseId" | "done">;
export default function EntryForm({ editEntry, caseId, done }: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.saveEntry(caseId, editEntry?.id, {
          action_date: str(f, "action_date"),
          description: str(f, "description"),
          is_payment_event: editEntry
            ? editEntry.is_payment_event
            : f.has("is_payment_event"),
        });
        await done();
      }}
    >
      <Field label="Fecha real de actuación">
        <input
          type="date"
          name="action_date"
          required
          defaultValue={editEntry?.action_date || localDate()}
        />
      </Field>
      <div className="full">
        <Field label="Descripción breve">
          <textarea
            name="description"
            required
            defaultValue={editEntry?.description}
          />
        </Field>
      </div>
      {!editEntry && (
        <label className="text-sm">
          <input type="checkbox" name="is_payment_event" /> Acto que podría
          activar una cuota
        </label>
      )}
      <p className="full muted text-xs">
        El usuario y la fecha de registro se guardan automáticamente y no se
        pueden editar.
      </p>
    </Form>
  );
}
