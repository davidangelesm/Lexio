import { Plus } from "lucide-react";
import { Card, Field, Form } from "../../components/ui/index";
import type { LexioState } from "../../hooks/useLexio";
import { administrationService } from "../../services/administration";
import { num } from "../../utils/form";

type Props = Pick<
  LexioState,
  | "setEditUser"
  | "setModal"
  | "users"
  | "load"
  | "noticeDays"
  | "audit"
  | "userName"
>;
export default function AdministrationPage({
  setEditUser,
  setModal,
  users,
  load,
  noticeDays,
  audit,
  userName,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Permisos y trazabilidad</p>
          <h1>Administración</h1>
          <p>
            El acceso financiero pertenece exclusivamente a tu cuenta
            administradora.
          </p>
        </div>
        <button
          className="primary"
          onClick={() => {
            setEditUser(undefined);
            setModal("usuario");
          }}
        >
          <Plus size={15} />
          Crear usuario
        </button>
      </div>
      <Card>
        <h2>Usuarios del estudio</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre / usuario</th>
                <th>Rol</th>
                <th>Crear clientes</th>
                <th>Crear casos</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((x) => (
                <tr key={x.id}>
                  <td>
                    {x.name}
                    <small>{x.username}</small>
                  </td>
                  <td>{x.role}</td>
                  <td>{x.can_create_clients ? "Sí" : "No"}</td>
                  <td>{x.can_create_cases ? "Sí" : "No"}</td>
                  <td>{x.active ? "Activo" : "Inactivo"}</td>
                  <td>
                    {x.role !== "admin" && (
                      <button
                        className="link-button"
                        onClick={() => {
                          setEditUser(x);
                          setModal("usuario");
                        }}
                      >
                        Editar permisos
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Card>
        <h2>Anticipación de avisos</h2>
        <Form
          submit={async (f) => {
            await administrationService.updateNoticeSettings({
              days: [num(f, "first"), num(f, "second"), num(f, "third")],
            });
            await load();
          }}
        >
          <Field label="Primer aviso (lunes a viernes)">
            <input
              name="first"
              type="number"
              min="1"
              max="60"
              defaultValue={noticeDays[0] ?? 5}
              required
            />
          </Field>
          <Field label="Segundo aviso">
            <input
              name="second"
              type="number"
              min="1"
              max="60"
              defaultValue={noticeDays[1] ?? 3}
              required
            />
          </Field>
          <Field label="Tercer aviso">
            <input
              name="third"
              type="number"
              min="1"
              max="60"
              defaultValue={noticeDays[2] ?? 1}
              required
            />
          </Field>
        </Form>
      </Card>
      <Card>
        <h2>Últimos cambios</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Registro UTC</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Recurso</th>
                <th>Cambio</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((x) => (
                <tr key={x.id}>
                  <td>{x.created_at}</td>
                  <td>{userName(x.user_id)}</td>
                  <td>{x.action}</td>
                  <td>
                    {x.resource} #{x.resource_id}
                  </td>
                  <td>
                    <details>
                      <summary>Ver cambio</summary>
                      <pre className="text-xs max-w-96 overflow-auto">
                        {x.changes}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
