import { Field, Form } from "../../../components/ui/index";
import { financeService } from "../../../services/finance";
import { num } from "../../../utils/form";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "done" | "events"> & {
  quota: NonNullable<CaseWorkspaceState["quota"]>;
};
export default function LinkEventForm({ quota, done, events }: Props) {
  return (
    <Form
      submit={async (f) => {
        await financeService.linkInstallmentEvent(quota.id, {
          event_id: num(f, "event_id"),
        });
        await done();
      }}
    >
      <div className="full">
        <Field label="Evento del caso">
          <select name="event_id" required defaultValue={quota.event_id || ""}>
            {events.map((x) => (
              <option key={x.id} value={x.id}>
                {x.description}
              </option>
            ))}
          </select>
        </Field>
        <p className="notice mt-4">
          El vínculo no confirma el vencimiento. Después confirma el efecto
          económico cuando se cumpla la condición.
        </p>
      </div>
    </Form>
  );
}
