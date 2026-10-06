import { Field, Form } from "../../../components/ui/index";
import type { LexioState } from "../../../hooks/useLexio";
import { administrationService } from "../../../services/administration";
import { str } from "../../../utils/form";

type Props = Pick<LexioState, "editUser" | "done">;
export default function UserForm({ editUser, done }: Props) {
  return (
    <Form
      submit={async (f) => {
        const base = {
          name: str(f, "name"),
          can_create_clients: f.has("can_create_clients"),
          can_create_cases: f.has("can_create_cases"),
        };
        if (editUser)
          await administrationService.updateUser(editUser.id, {
            ...base,
            active: f.has("active"),
            password: str(f, "password") || null,
          });
        else
          await administrationService.createUser({
            ...base,
            email: str(f, "email"),
            password: str(f, "password"),
          });
        await done();
      }}
    >
      <Field label="Nombre">
        <input name="name" required defaultValue={editUser?.name} />
      </Field>
      {!editUser && (
        <Field label="Correo de acceso">
          <input name="email" type="email" required />
        </Field>
      )}
      <Field
        label={
          editUser
            ? "Nueva contraseña (opcional)"
            : "Contraseña (mínimo 12 caracteres)"
        }
      >
        <input
          name="password"
          type="password"
          minLength={12}
          required={!editUser}
          autoComplete="new-password"
        />
      </Field>
      <div className="full flex gap-5 text-sm">
        <label>
          <input
            type="checkbox"
            name="can_create_clients"
            defaultChecked={editUser?.can_create_clients}
          />{" "}
          Crear clientes
        </label>
        <label>
          <input
            type="checkbox"
            name="can_create_cases"
            defaultChecked={editUser?.can_create_cases}
          />{" "}
          Crear casos
        </label>
        {editUser && (
          <label>
            <input
              type="checkbox"
              name="active"
              defaultChecked={editUser.active}
            />{" "}
            Cuenta activa
          </label>
        )}
      </div>
      <p className="full muted text-xs">
        Autoriza cada caso desde su ficha. Estos permisos no conceden acceso
        financiero.
      </p>
    </Form>
  );
}
