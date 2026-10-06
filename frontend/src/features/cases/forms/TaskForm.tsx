import type { ReactNode } from "react";
import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { num, str } from "../../../utils/form";
import { localDate } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "editTask" | "caseId" | "done" | "caseData" | "entries"
> & { responsibleSelect: (value?: number) => ReactNode };
export default function TaskForm({
  editTask,
  caseId,
  done,
  responsibleSelect,
  caseData,
  entries,
}: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.saveTask(caseId, editTask?.id, {
          description: str(f, "description"),
          responsible_id: num(f, "responsible_id"),
          due_date: str(f, "due_date"),
          status: str(f, "status"),
          entry_id: str(f, "entry_id") ? num(f, "entry_id") : null,
        });
        await done();
      }}
    >
      <div className="full">
        <Field label="Descripción">
          <input
            name="description"
            required
            defaultValue={editTask?.description}
          />
        </Field>
      </div>
      <Field label="Responsable autorizado">
        {responsibleSelect(editTask?.responsible_id || caseData.responsible_id)}
      </Field>
      <Field label="Fecha límite validada">
        <input
          type="date"
          name="due_date"
          required
          defaultValue={editTask?.due_date || localDate()}
        />
      </Field>
      <Field label="Estado">
        <select name="status" defaultValue={editTask?.status || "pendiente"}>
          {["pendiente", "atendida", "cancelada"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Actuación de origen (opcional)">
        <select name="entry_id" defaultValue={editTask?.entry_id || ""}>
          <option value="">Sin actuación</option>
          {entries.map((x) => (
            <option key={x.id} value={x.id}>
              {x.description.slice(0, 65)}
            </option>
          ))}
        </select>
      </Field>
    </Form>
  );
}
