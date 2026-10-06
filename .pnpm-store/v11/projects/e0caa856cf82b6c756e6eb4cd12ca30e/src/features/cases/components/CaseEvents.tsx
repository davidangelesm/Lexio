import { Plus } from "lucide-react";
import { Card, Empty } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import { dateLabel } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  | "canEdit"
  | "setEditEvent"
  | "setModal"
  | "events"
  | "isAdmin"
  | "action"
  | "caseId"
>;
export default function CaseEvents({
  canEdit,
  setEditEvent,
  setModal,
  events,
  isAdmin,
  action,
  caseId,
}: Props) {
  return (
    <Card>
      <div className="card-head">
        <h2>Audiencias y eventos concretos</h2>
        {canEdit && (
          <button
            className="primary"
            onClick={() => {
              setEditEvent(undefined);
              setModal("evento");
            }}
          >
            <Plus size={15} />
            Evento
          </button>
        )}
      </div>
      {!events.length ? (
        <Empty />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Acto</th>
                <th>Programado</th>
                <th>Hecho efectivo</th>
                <th>Revisión</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((x) => (
                <tr key={x.id}>
                  <td>{x.description}</td>
                  <td>{dateLabel(x.scheduled_date)}</td>
                  <td>
                    {x.effective_kind || "Sin confirmar"}
                    <small>{dateLabel(x.effective_date)}</small>
                  </td>
                  <td>
                    {x.revision}
                    {isAdmin && x.reviewed_revision < x.revision && (
                      <button
                        className="link-button block"
                        onClick={() =>
                          void action(() =>
                            casesService.reviewEvent(caseId, x.id),
                          )
                        }
                      >
                        Marcar revisado
                      </button>
                    )}
                  </td>
                  <td>
                    {canEdit && (
                      <button
                        className="link-button"
                        onClick={() => {
                          setEditEvent(x);
                          setModal("evento");
                        }}
                      >
                        Registrar / reprogramar
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
