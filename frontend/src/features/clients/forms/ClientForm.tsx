import { Field, Form } from "../../../components/ui";
import { clientsService } from "../../../services/clients";
import type { Client } from "../../../types";
import type { ClientInput } from "../../../types/requests";
import { str } from "../../../utils/form";
type Props = { item?: Client; saved: (client: Client) => Promise<void> | void };
export default function ClientForm({ item, saved }: Props) {
  return (
    <Form
      label={item ? "Guardar cambios" : "Registrar cliente"}
      submit={async (form) => {
        const data: ClientInput = {
          name: str(form, "name"),
          document_type: str(form, "document_type"),
          document_number: str(form, "document_number"),
          phone: str(form, "phone"),
          email: str(form, "email"),
          address: str(form, "address"),
        };
        await saved(
          item
            ? await clientsService.update(item.id, data)
            : await clientsService.create(data),
        );
      }}
    >
      <p className="full notice">
        {item
          ? `Código del cliente: ${item.code}`
          : "El código del cliente se genera automáticamente al guardar."}
      </p>
      <div className="full">
        <Field label="Nombres y apellidos">
          <input
            name="name"
            required
            maxLength={180}
            defaultValue={item?.name}
          />
        </Field>
      </div>
      <Field label="Documento de identificación">
        <select
          name="document_type"
          defaultValue={item?.document_type || "DNI"}
        >
          <option>DNI</option>
          <option>RUC</option>
          <option>CE</option>
        </select>
      </Field>
      <Field label="Número de documento">
        <input
          name="document_number"
          required
          maxLength={20}
          defaultValue={item?.document_number}
        />
      </Field>
      <Field label="Celular">
        <input
          name="phone"
          type="tel"
          maxLength={30}
          defaultValue={item?.phone}
        />
      </Field>
      <Field label="Correo">
        <input
          name="email"
          type="email"
          maxLength={254}
          defaultValue={item?.email}
        />
      </Field>
      <div className="full">
        <Field label="Dirección">
          <input name="address" maxLength={250} defaultValue={item?.address} />
        </Field>
      </div>
    </Form>
  );
}
