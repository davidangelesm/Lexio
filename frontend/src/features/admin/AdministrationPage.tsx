import { Plus } from "lucide-react";
import { Card } from "../../components/ui";
import type { LexioState } from "../../hooks/useLexio";
import { dateTimeLabels } from "../../utils/format";
type Props = Pick<LexioState, "setEditUser" | "setModal" | "users" | "audit">;
export default function AdministrationPage({
  setEditUser,
  setModal,
  users,
  audit,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Equipo del estudio</p>
          <h1>Administración</h1>
          <p>Usuarios, permisos y últimos cambios.</p>
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
                <th>Crear casos</th>
                <th>Estado</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    {user.name}
                    <small>{user.username}</small>
                  </td>
                  <td>
                    {user.role === "admin"
                      ? "Administrador"
                      : "Equipo jurídico"}
                  </td>
                  <td>
                    {user.role === "admin" || user.can_create_cases
                      ? "Sí"
                      : "No"}
                  </td>
                  <td>{user.active ? "Activo" : "Inactivo"}</td>
                  <td>
                    {user.role !== "admin" && (
                      <button
                        className="secondary"
                        onClick={() => {
                          setEditUser(user);
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
        <h2>Últimos cambios</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((item) => {
                const labels = dateTimeLabels(item.created_at);
                return (
                  <tr key={item.id}>
                    <td>
                      {labels.date}
                      <small>{labels.time}</small>
                    </td>
                    <td>{item.user_name}</td>
                    <td>{item.action}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
