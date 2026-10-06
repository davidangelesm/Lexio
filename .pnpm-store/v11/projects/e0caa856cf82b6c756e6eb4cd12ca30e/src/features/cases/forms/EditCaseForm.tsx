import type { ReactNode } from "react";
import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { num, str } from "../../../utils/form";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "caseId" | "done" | "caseData"> & {
  responsibleSelect: (value?: number) => ReactNode;
};
export default function EditCaseForm({
  caseId,
  done,
  caseData,
  responsibleSelect,
}: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.update(caseId, {
          area: str(f, "area"),
          subject: str(f, "subject"),
          description: str(f, "description"),
          current_stage: str(f, "current_stage"),
          status: str(f, "status"),
          responsible_id: num(f, "responsible_id"),
          reference: str(f, "reference"),
        });
        await done();
      }}
    >
      <Field label="Rama / área">
        <input name="area" required defaultValue={caseData.area} />
      </Field>
      <Field label="Materia">
        <input name="subject" required defaultValue={caseData.subject} />
      </Field>
      <Field label="Etapa actual">
        <input
          name="current_stage"
          required
          defaultValue={caseData.current_stage}
        />
      </Field>
      <Field label="Estado">
        <select name="status" defaultValue={caseData.status}>
          {["activo", "suspendido", "concluido"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Responsable autorizado">
        {responsibleSelect(caseData.responsible_id)}
      </Field>
      <Field label="Expediente / referencia">
        <input name="reference" defaultValue={caseData.reference} />
      </Field>
      <div className="full">
        <Field label="Descripción">
          <textarea
            name="description"
            required
            defaultValue={caseData.description}
          />
        </Field>
      </div>
    </Form>
  );
}
