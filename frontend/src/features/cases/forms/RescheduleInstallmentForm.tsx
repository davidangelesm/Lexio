import { Field, Form } from "../../../components/ui/index";
import { financeService } from "../../../services/finance";
import { str } from "../../../utils/form";
import { localDate } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "done"> & {
  quota: NonNullable<CaseWorkspaceState["quota"]>;
};
export default function RescheduleInstallmentForm({ quota, done }: Props) {
  return (
    <Form
      submit={async (f) => {
        await financeService.rescheduleInstallment(quota.id, {
          due_date: str(f, "due_date"),
          reason: str(f, "reason"),
        });
        await done();
      }}
    >
      <Field label="Nueva fecha pactada">
        <input
          type="date"
          name="due_date"
          required
          defaultValue={quota.due_date || localDate()}
        />
      </Field>
      <Field label="Motivo">
        <input name="reason" required minLength={5} />
      </Field>
    </Form>
  );
}
