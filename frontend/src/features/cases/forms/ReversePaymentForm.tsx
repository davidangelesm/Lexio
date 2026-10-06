import { Field, Form } from "../../../components/ui/index";
import { financeService } from "../../../services/finance";
import { str } from "../../../utils/form";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<CaseWorkspaceState, "paymentId" | "done">;
export default function ReversePaymentForm({ paymentId, done }: Props) {
  return (
    <Form
      label="Confirmar reversión"
      submit={async (f) => {
        await financeService.reversePayment(paymentId, {
          reason: str(f, "reason"),
        });
        await done();
      }}
    >
      <p className="full notice">
        Se conserva el pago original y sus aplicaciones. La reversión restaura
        los saldos.
      </p>
      <div className="full">
        <Field label="Motivo de reversión">
          <textarea name="reason" required minLength={5} />
        </Field>
      </div>
    </Form>
  );
}
