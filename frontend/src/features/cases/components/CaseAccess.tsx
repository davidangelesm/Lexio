import { Plus } from "lucide-react";
import { Card } from "../../../components/ui/index";
import { casesService } from "../../../services/cases";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "setModal" | "access" | "userName" | "action" | "caseId"
>;
export default function CaseAccess({
  setModal,
  access,
  userName,
  action,
  caseId,
}: Props) {
  return (
    <Card>
      <div className="card-head">
        <h2>Usuarios autorizados en este caso</h2>
        <button className="primary" onClick={() => setModal("permiso")}>
          <Plus size={15} />
          Autorizar
        </button>
      </div>
      {access.map((x) => (
        <div
          key={x.id}
          className="flex justify-between py-4 border-b border-gray-100"
        >
          <span>
            {userName(x.user_id)} ·{" "}
            {x.level === "edit" ? "Lectura y edición" : "Lectura"}
          </span>
          <button
            className="link-button"
            onClick={() =>
              void action(() => casesService.revokeAccess(caseId, x.user_id))
            }
          >
            Revocar
          </button>
        </div>
      ))}
    </Card>
  );
}
