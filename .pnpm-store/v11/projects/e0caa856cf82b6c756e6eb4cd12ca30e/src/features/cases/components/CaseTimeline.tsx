import { Plus } from "lucide-react";
import { Badge, Card, Empty } from "../../../components/ui/index";
import { dateLabel } from "../../../utils/format";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "canEdit" | "setEditEntry" | "setModal" | "entries" | "userName"
>;
export default function CaseTimeline({
  canEdit,
  setEditEntry,
  setModal,
  entries,
  userName,
}: Props) {
  return (
    <Card>
      <div className="card-head">
        <h2>Historia del caso</h2>
        {canEdit && (
          <button
            className="primary"
            onClick={() => {
              setEditEntry(undefined);
              setModal("actuacion");
            }}
          >
            <Plus size={15} />
            Actuación
          </button>
        )}
      </div>
      {!entries.length ? (
        <Empty />
      ) : (
        <div className="timeline">
          {entries.map((x) => (
            <article key={x.id}>
              <Badge>{dateLabel(x.action_date)}</Badge>
              <p>{x.description}</p>
              <small>
                Registró {userName(x.registered_by)} · {dateLabel(x.created_at)}{" "}
                {x.created_at.slice(11, 16)} UTC
              </small>
              {canEdit && (
                <button
                  className="link-button ml-3"
                  onClick={() => {
                    setEditEntry(x);
                    setModal("actuacion");
                  }}
                >
                  Corregir
                </button>
              )}
              {x.is_payment_event && <Badge>Evento para revisión</Badge>}
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
