import { ExternalLink, FileText, Plus } from "lucide-react";
import { Badge, Card, Empty } from "../../../components/ui/index";
import type { CaseWorkspaceState } from "../hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "canEdit" | "setModal" | "files" | "action" | "openFile"
>;
export default function CaseFiles({
  canEdit,
  setModal,
  files,
  action,
  openFile,
}: Props) {
  return (
    <Card>
      <div className="card-head">
        <h2>Documentos del caso</h2>
        {canEdit && (
          <button className="primary" onClick={() => setModal("archivo")}>
            <Plus size={15} />
            Enlace de archivo
          </button>
        )}
      </div>
      <p className="notice">
        Usa enlaces privados de Google Drive y concede acceso allí solo a los
        usuarios autorizados. El permiso de Lexio no revoca permisos externos de
        Drive.
      </p>
      {!files.length ? (
        <Empty />
      ) : (
        files.map((x) => (
          <div
            className="flex justify-between py-4 border-b border-gray-100"
            key={x.id}
          >
            <div className="flex gap-3 items-center">
              <FileText size={20} />
              <span>{x.title}</span>
              <Badge>{x.classification}</Badge>
            </div>
            <button
              className="secondary"
              onClick={() => void action(() => openFile(x.id))}
            >
              <ExternalLink size={14} />
              Abrir
            </button>
          </div>
        ))
      )}
    </Card>
  );
}
