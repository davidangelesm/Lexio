import { useEffect, useState } from "react";
import { Field, Form } from "../../../components/ui";
import { casesService } from "../../../services/cases";
import type { Access, Case, User } from "../../../types";
import { str } from "../../../utils/form";

export function availableAssistants(users: User[], access: Access[]): User[] {
  return users.filter(
    (user) =>
      user.active &&
      user.role === "staff" &&
      !access.some((member) => member.user_id === user.id),
  );
}

type Props = { item: Case; users: User[]; changed: () => Promise<void> };
export default function CaseAccess({ item, users, changed }: Props) {
  const [access, setAccess] = useState<Access[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const available = availableAssistants(users, access);
  const administrators = users.filter(
    (user) => user.role === "admin" && user.active,
  );
  const assistants = access.filter(
    (member) =>
      member.user_id !== item.responsible_id &&
      !users.some(
        (user) => user.id === member.user_id && user.role === "admin",
      ),
  );
  async function load() {
    try {
      setAccess(await casesService.access(item.id));
      setLoaded(true);
    } catch (e) {
      setLoaded(false);
      throw e;
    }
  }
  useEffect(() => {
    setLoading(true);
    void load()
      .catch((e) =>
        setError(
          e instanceof Error ? e.message : "No se pudo cargar el equipo.",
        ),
      )
      .finally(() => setLoading(false));
  }, [item.id]);
  async function changePermission(member: Access, level?: string) {
    setBusy(true);
    setError("");
    try {
      if (level)
        await casesService.saveAccess(item.id, {
          user_id: member.user_id,
          level,
        });
      else await casesService.removeAccess(item.id, member.user_id);
      await load();
      await changed();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo actualizar el equipo.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p className="muted text-sm">
        El abogado responsable y el administrador tienen acceso permanente al
        caso. Puedes autorizar a otros miembros del equipo para que apoyen en el
        seguimiento.
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
            {administrators.map((user) => (
              <tr key={`admin-${user.id}`}>
                <td>
                  {user.name}
                  <small>
                    {user.id === item.responsible_id
                      ? "Responsable del caso"
                      : "Administrador"}
                  </small>
                </td>
                <td>Administrador</td>
                <td>
                  <span className="muted">Acceso permanente</span>
                </td>
              </tr>
            ))}
            {!administrators.some((u) => u.id === item.responsible_id) && (
              <tr key={`resp-${item.responsible_id}`}>
                <td>
                  {item.responsible_name}
                  <small>Responsable del caso</small>
                </td>
                <td>Abogado responsable</td>
                <td>
                  <span className="muted">Acceso permanente</span>
                </td>
              </tr>
            )}
            {assistants.map((member) => (
              <tr key={member.id}>
                <td>
                  {member.user_name}
                  <small>Asistente</small>
                </td>
                <td>
                  <select
                    aria-label={`Permiso de ${member.user_name}`}
                    value={member.level}
                    disabled={busy || loading}
                    onChange={(event) =>
                      void changePermission(member, event.target.value)
                    }
                  >
                    <option value="edit">Consultar y editar</option>
                    <option value="read">Solo consultar</option>
                  </select>
                </td>
                <td>
                  <button
                    className="danger"
                    disabled={busy || loading}
                    onClick={() => void changePermission(member)}
                  >
                    Retirar acceso
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-[#bfcfc8] bg-[#f4f8f6] p-5">
        <h3>Agregar asistente</h3>
        {loading ? (
          <p className="muted mb-0 text-sm">Cargando equipo…</p>
        ) : !loaded ? (
          <p className="muted mb-0 text-sm">
            Vuelve a abrir el equipo para cargar los asistentes disponibles.
          </p>
        ) : available.length === 0 ? (
          <p className="muted mb-0 text-sm">
            No hay asistentes disponibles para agregar.
          </p>
        ) : (
          <Form
            key={available.map((user) => user.id).join(",")}
            label="Agregar al equipo"
            submit={async (form) => {
              if (busy) return;
              setBusy(true);
              try {
                await casesService.saveAccess(item.id, {
                  user_id: Number(str(form, "user_id")),
                  level: str(form, "level"),
                });
                await load();
                await changed();
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Asistente">
              <select name="user_id" defaultValue="" required disabled={busy}>
                <option value="">Selecciona un asistente</option>
                {available.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Permiso">
              <select name="level" disabled={busy}>
                <option value="edit">Consultar y editar</option>
                <option value="read">Solo consultar</option>
              </select>
            </Field>
          </Form>
        )}
      </div>
    </>
  );
}
