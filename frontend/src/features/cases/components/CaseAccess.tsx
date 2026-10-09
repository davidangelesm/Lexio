import { useEffect, useState } from "react";
import { Field, Form } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Access, User } from "../../../types";
import { str } from "../../../utils/form";
type Props = { caseId: number; users: User[] };
export default function CaseAccess({ caseId, users }: Props) {
  const [access, setAccess] = useState<Access[]>([]);
  const [error, setError] = useState("");
  async function load() {
    setAccess(await casesService.access(caseId));
  }
  useEffect(() => {
    void load().catch((e) =>
      setError(e instanceof Error ? e.message : "No se pudo cargar el equipo."),
    );
  }, [caseId]);
  return (
    <>
      <p className="muted text-sm">
        Autoriza quién puede consultar o registrar actuaciones en este caso.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="table-wrap mb-5">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Permiso</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {access.map((item) => {
              const isAdmin = users.some(
                (user) => user.id === item.user_id && user.role === "admin",
              );
              return (
                <tr key={item.id}>
                  <td>{item.user_name}</td>
                  <td>
                    {isAdmin
                      ? "Administrador"
                      : item.level === "edit"
                        ? "Consultar y editar"
                        : "Solo consultar"}
                  </td>
                  <td>
                    {isAdmin ? (
                      <span className="muted">Acceso permanente</span>
                    ) : (
                      <button
                        className="danger"
                        onClick={async () => {
                          setError("");
                          try {
                            await casesService.removeAccess(
                              caseId,
                              item.user_id,
                            );
                            await load();
                          } catch (e) {
                            setError(
                              e instanceof Error
                                ? e.message
                                : "No se pudo retirar el permiso.",
                            );
                          }
                        }}
                      >
                        Retirar acceso
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Form
        label="Guardar permiso"
        submit={async (form) => {
          await casesService.saveAccess(caseId, {
            user_id: Number(str(form, "user_id")),
            level: str(form, "level"),
          });
          await load();
        }}
      >
        <Field label="Usuario">
          <select name="user_id" defaultValue="" required>
            <option value="">Selecciona un usuario</option>
            {users
              .filter((user) => user.active && user.role !== "admin")
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Permiso">
          <select name="level">
            <option value="edit">Consultar y editar</option>
            <option value="read">Solo consultar</option>
          </select>
        </Field>
      </Form>
    </>
  );
}
