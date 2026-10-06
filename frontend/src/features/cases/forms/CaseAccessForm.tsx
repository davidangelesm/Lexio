import { Field, Form } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { num, str } from "../../../utils/form";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "caseId" | "done" | "users">;
export default function CaseAccessForm({ caseId, done, users }: Props) {
  return (
    <Form
      submit={async (f) => {
        await casesService.grantAccess(caseId, {
          user_id: num(f, "user_id"),
          level: str(f, "level"),
        });
        await done();
      }}
    >
      <Field label="Usuario">
        <select name="user_id" required>
          {users
            .filter((x) => x.active && x.role !== "admin")
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Nivel">
        <select name="level">
          <option value="read">Lectura</option>
          <option value="edit">Lectura y edición</option>
        </select>
      </Field>
    </Form>
  );
}
