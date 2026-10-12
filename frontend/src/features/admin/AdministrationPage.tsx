import { Plus } from "lucide-react";
import { Card } from "../../components/ui";
import type { LexioState } from "../../hooks/useLexio";
import { dateTimeLabels } from "../../utils/format";
type Props = Pick<
  LexioState,
  "setEditUser" | "setModal" | "users" | "audit" | "areas"
>;
export default function AdministrationPage({
  setEditUser,
  setModal,
  users,
  audit,
  areas,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Equipo del estudio</p>
          <h1>Administración</h1>
          <p>Usuarios, permisos, ramas de derecho y últimos cambios.</p>
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
                    {user.role === "admin" ? "Administrador" : "Asistente"}
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
      <Card className="flex items-start gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="py-2 text-sm">
            <h2 className="inline text-sm">Ramas de derecho</h2>{" "}
            <span className="muted">({areas.length})</span>
          </div>
          {areas.length === 0 ? (
            <p className="muted mt-3 mb-0 text-sm">
              Todavía no hay ramas de derecho registradas.
            </p>
          ) : (
            <ul className="mt-3 flex list-none flex-wrap gap-2 p-0 text-sm">
              {areas.map((area) => (
                <li key={area.id} className="rounded-md bg-[#f3f5f4] px-3 py-1">
                  {area.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="secondary shrink-0" onClick={() => setModal("rama")}>
          <Plus size={15} />
          Agregar rama
        </button>
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
