import { useEffect, useState } from "react";
import { Badge, Empty, Field, Form } from "../../components/ui/index";
import { clientsService } from "../../services/clients";
import { openPrivateFile } from "../../services/files";
import type { Client, FileLink } from "../../types/index";
import { str } from "../../utils/form";

export default function ClientFiles({
  client,
  isAdmin,
}: {
  client: Client;
  isAdmin: boolean;
}) {
  const [files, setFiles] = useState<FileLink[]>([]);
  const [error, setError] = useState("");
  async function load() {
    try {
      setFiles(await clientsService.listFiles(client.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }
  useEffect(() => {
    void load();
  }, [client.id]);
  async function open(id: number) {
    try {
      await openPrivateFile(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }
  return (
    <>
      <p className="muted text-sm">
        {client.name} · {client.code}. Documentos generales, sin caso
        específico.
      </p>
      <p className="notice">
        Los permisos de Google Drive se administran también en Drive. Evita
        enlaces públicos.
      </p>
      {error && <p className="error">{error}</p>}
      {!files.length ? (
        <Empty />
      ) : (
        files.map((x) => (
          <div key={x.id} className="flex justify-between gap-3 py-4">
            <span>
              {x.title} <Badge>{x.classification}</Badge>
            </span>
            <button className="link-button" onClick={() => void open(x.id)}>
              Abrir
            </button>
          </div>
        ))
      )}
      {isAdmin && (
        <div className="mt-6">
          <Form
            label="Registrar documento"
            submit={async (f) => {
              await clientsService.createFile(client.id, {
                title: str(f, "title"),
                url: str(f, "url"),
                classification: str(f, "classification"),
              });
              await load();
            }}
          >
            <Field label="Nombre del documento">
              <input name="title" required />
            </Field>
            <Field label="Clasificación">
              <select name="classification">
                <option value="operativo">Operativo</option>
                <option value="financiero">Financiero</option>
              </select>
            </Field>
            <div className="full">
              <Field label="Enlace HTTPS">
                <input type="url" name="url" required />
              </Field>
            </div>
          </Form>
        </div>
      )}
    </>
  );
}
