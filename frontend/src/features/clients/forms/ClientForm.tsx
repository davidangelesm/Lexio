import { Field, Form } from "../../../components/ui/index";
import type { LexioState } from "../../../hooks/useLexio";
import { clientsService } from "../../../services/clients";
import { str } from "../../../utils/form";

type Props = Pick<
  LexioState,
  "editClient" | "isAdmin" | "setNewCaseClient" | "setModal" | "done"
> & { actor: NonNullable<LexioState["actor"]> };
export default function ClientForm({
  editClient,
  isAdmin,
  actor,
  setNewCaseClient,
  setModal,
  done,
}: Props) {
  return (
    <Form
      submit={async (f) => {
        const result = await clientsService.save(editClient?.id, {
          document_type: str(f, "document_type"),
          document_number: str(f, "document_number"),
          name: str(f, "name"),
          phone: str(f, "phone"),
          email: str(f, "email"),
          address: str(f, "address"),
        });
        if (!editClient && (isAdmin || actor.can_create_cases)) {
          setNewCaseClient(result);
          setModal("caso");
        } else await done();
      }}
    >
      <Field label="Tipo de documento">
        <select
          name="document_type"
          defaultValue={editClient?.document_type || "DNI"}
        >
          {["DNI", "RUC", "CE"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </Field>
      <Field label="Número como texto">
        <input
          name="document_number"
          required
          maxLength={20}
          defaultValue={editClient?.document_number}
        />
      </Field>
      <div className="full">
        <Field label="Nombres y apellidos / razón social">
          <input name="name" required defaultValue={editClient?.name} />
        </Field>
      </div>
      <Field label="Celular">
        <input name="phone" defaultValue={editClient?.phone} />
      </Field>
      <Field label="Correo">
        <input name="email" type="email" defaultValue={editClient?.email} />
      </Field>
      <div className="full">
        <Field label="Dirección">
          <input name="address" defaultValue={editClient?.address} />
        </Field>
      </div>
    </Form>
  );
}
