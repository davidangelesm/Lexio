import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Card, Field, Form, Modal } from "../../components/ui";
import type { LexioState } from "../../hooks/useLexio";
import { administrationService } from "../../services/administration";
import type { User } from "../../types";
import { dateTimeLabels } from "../../utils/format";
import { str } from "../../utils/form";
type Props = Pick<
  LexioState,
  "setEditUser" | "setModal" | "users" | "audit" | "areas"
> &
  Partial<Pick<LexioState, "load" | "actor" | "updateActor">>;
export default function AdministrationPage({
  actor,
  updateActor,
  setEditUser,
  setModal,
  users,
  audit,
  areas,
  load,
}: Props) {
  const [confirmRemove, setConfirmRemove] = useState<User>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedNotice, setSavedNotice] = useState("");
  if (actor && actor.role !== "admin") {
    return (
      <>
        <div className="page-head">
          <div>
            <p className="eyebrow">Mi cuenta</p>
            <h1>Configuración</h1>
            <p>Actualiza tu nombre, usuario de acceso y contraseña.</p>
          </div>
        </div>
        <Card>
          <h2>Datos de mi cuenta</h2>
          {savedNotice && <p className="notice">{savedNotice}</p>}
          <Form
            submit={async (f) => {
              setSavedNotice("");
              const updated = await administrationService.updateProfile({
                name: str(f, "name"),
                username: str(f, "username"),
                password: str(f, "password") || null,
              });
              updateActor?.(updated);
              await load?.();
              setSavedNotice("Datos actualizados correctamente.");
            }}
          >
            <Field label="Nombre">
              <input name="name" required defaultValue={actor.name} />
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
                defaultValue={actor.username}
                placeholder="juan.perez"
                title="De 3 a 50 caracteres: letras sin tildes, números, punto, guion o guion bajo. Comienza con letra o número."
              />
            </Field>
            <Field label="Nueva contraseña (opcional)">
              <input
                name="password"
                type="password"
                minLength={6}
                autoComplete="new-password"
              />
            </Field>
            <p className="full muted text-sm">
              El usuario no distingue mayúsculas y minúsculas. Debe ser único en
              la plataforma.
            </p>
          </Form>
        </Card>
      </>
    );
  }
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Equipo del estudio</p>
          <h1>Configuración</h1>
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
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "30%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "160px" }} />
              <col style={{ width: "64px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Nombre / usuario</th>
                <th>Rol</th>
                <th>Crear casos</th>
                <th>Estado</th>
                <th>Acción</th>
                <th aria-label="Eliminar"></th>
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
                  <td className="text-right">
                    {user.role !== "admin" && (
                      <button
                        type="button"
                        className="icon-button danger"
                        title="Eliminar asistente"
                        aria-label={`Eliminar a ${user.name}`}
                        onClick={() => {
                          setError("");
                          setConfirmRemove(user);
                        }}
                      >
                        <Trash2 size={16} />
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
        <div className="card-head">
          <div>
            <h2>
              Ramas de derecho <span className="muted">({areas.length})</span>
            </h2>
          </div>
          <button
            className="secondary shrink-0"
            onClick={() => setModal("rama")}
          >
            <Plus size={15} />
            Agregar rama
          </button>
        </div>
        {areas.length === 0 ? (
          <p className="muted mb-0">
            Todavía no hay ramas de derecho registradas.
          </p>
        ) : (
          <ul className="area-list">
            {areas.map((area) => (
              <li key={area.id} className="area-chip">
                {area.name}
              </li>
            ))}
          </ul>
        )}
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
      {confirmRemove && (
        <Modal
          title="Eliminar asistente"
          close={() => {
            if (!busy) {
              setConfirmRemove(undefined);
              setError("");
            }
          }}
        >
          <p>
            ¿Estás seguro de que deseas eliminar a{" "}
            <strong>{confirmRemove.name}</strong> ({confirmRemove.username})? Se
            retirará su cuenta y sus accesos a los casos del estudio.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                setConfirmRemove(undefined);
                setError("");
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError("");
                try {
                  await administrationService.removeUser(confirmRemove.id);
                  setConfirmRemove(undefined);
                  await load?.();
                } catch (e) {
                  setError(
                    e instanceof Error
                      ? e.message
                      : "No se pudo eliminar el usuario.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Eliminando…" : "Confirmar eliminación"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
