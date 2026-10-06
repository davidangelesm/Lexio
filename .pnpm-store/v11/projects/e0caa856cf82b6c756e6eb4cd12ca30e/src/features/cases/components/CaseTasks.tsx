import { Plus } from "lucide-react";
import { Badge, Card, Empty } from "../../../components/ui/index";
import { dateLabel } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "canEdit" | "setEditTask" | "setModal" | "tasks" | "userName"
>;
export default function CaseTasks({
  canEdit,
  setEditTask,
  setModal,
  tasks,
  userName,
}: Props) {
  return (
    <Card>
      <div className="card-head">
        <h2>Vencimientos procesales</h2>
        {canEdit && (
          <button
            className="primary"
            onClick={() => {
              setEditTask(undefined);
              setModal("tarea");
            }}
          >
            <Plus size={15} />
            Tarea
          </button>
        )}
      </div>
      <p className="muted text-xs">
        La fecha límite la valida el responsable. Los avisos usan lunes a
        viernes; no se calculan plazos jurídicos.
      </p>
      {!tasks.length ? (
        <Empty />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Responsable</th>
                <th>Fecha límite</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tasks.map((x) => (
                <tr key={x.id}>
                  <td>{x.description}</td>
                  <td>{userName(x.responsible_id)}</td>
                  <td>{dateLabel(x.due_date)}</td>
                  <td>
                    <Badge>{x.status}</Badge>
                  </td>
                  <td>
                    {canEdit && (
                      <button
                        className="link-button"
                        onClick={() => {
                          setEditTask(x);
                          setModal("tarea");
                        }}
                      >
                        Editar / atender
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
