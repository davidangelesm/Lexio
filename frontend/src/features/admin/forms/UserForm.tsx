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
          username: str(f, "username"),
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
            password: str(f, "password"),
          });
        await done();
      }}
    >
      <Field label="Nombre">
        <input name="name" required defaultValue={editUser?.name} />
      </Field>
      <Field label="Usuario de acceso">
        <input
          name="username"
          type="text"
          required
          minLength={3}
          maxLength={50}
          pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={editUser?.username}
          placeholder="juan.perez"
          title="De 3 a 50 caracteres: letras sin tildes, números, punto, guion o guion bajo. Comienza con letra o número."
        />
      </Field>
      <Field
        label={
          editUser
            ? "Nueva contraseña (opcional)"
            : "Contraseña (mínimo 6 caracteres)"
        }
      >
        <input
          name="password"
          type="password"
          minLength={6}
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
        El usuario no distingue mayúsculas y minúsculas. Debe ser único.{" "}
        Autoriza cada caso desde su ficha. Estos permisos no conceden acceso
        financiero.
      </p>
    </Form>
  );
}
