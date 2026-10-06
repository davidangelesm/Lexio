import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { str } from "../../../utils/form";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "caseId" | "done" | "isAdmin">;
export default function CaseFileForm({ caseId, done, isAdmin }: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.createFile(caseId, {
          title: str(f, "title"),
          url: str(f, "url"),
          classification: str(f, "classification"),
        });
        await done();
      }}
    >
      <Field label="Nombre del documento">
        <input name="title" required />
      </Field>
      <Field label="Clasificación">
        <select name="classification">
          <option value="operativo">Operativo</option>
          {isAdmin && (
            <option value="financiero">Financiero · exclusivo</option>
          )}
        </select>
      </Field>
      <div className="full">
        <Field label="Enlace HTTPS de Google Drive">
          <input type="url" name="url" required />
        </Field>
      </div>
    </Form>
  );
}
