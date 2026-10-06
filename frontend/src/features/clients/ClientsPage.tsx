import { Plus } from "lucide-react";
import { Card, Empty, Field } from "../../components/ui/index";
import type { LexioState } from "../../hooks/useLexio";

type Props = Pick<
  LexioState,
  | "isAdmin"
  | "setEditClient"
  | "setModal"
  | "load"
  | "docType"
  | "setDocType"
  | "search"
  | "setSearch"
  | "busy"
  | "clients"
  | "setClientFilter"
  | "setPage"
  | "setFileClient"
  | "setNewCaseClient"
> & { actor: NonNullable<LexioState["actor"]> };
export default function ClientsPage({
  isAdmin,
  actor,
  setEditClient,
  setModal,
  load,
  docType,
  setDocType,
  search,
  setSearch,
  busy,
  clients,
  setClientFilter,
  setPage,
  setFileClient,
  setNewCaseClient,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Identificación por documento</p>
          <h1>Clientes</h1>
          <p>Datos estables para todos los casos de cada cliente.</p>
        </div>
        {(isAdmin || actor.can_create_clients) && (
          <button
            className="primary"
            onClick={() => {
              setEditClient(undefined);
              setModal("cliente");
            }}
          >
            <Plus size={15} />
            Registrar cliente
          </button>
        )}
      </div>
      <Card>
        <form
          className="filters"
          onSubmit={(e) => {
            e.preventDefault();
            void load();
          }}
        >
          <Field label="Tipo de documento">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="">Todos</option>
              {["DNI", "RUC", "CE"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="Documento o nombre">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Conserva los ceros iniciales"
            />
          </Field>
          <button className="primary" disabled={busy}>
            Buscar
          </button>
        </form>
        {!clients.length ? (
          <Empty
            text={
              busy
                ? "Buscando…"
                : "Sin clientes visibles. Solicita autorización si el cliente ya está registrado."
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Documento</th>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {clients.map((x) => (
                  <tr key={x.id}>
                    <td>
                      {x.code}
                      <small>ID {x.id}</small>
                    </td>
                    <td>{x.name}</td>
                    <td>
                      {x.phone || "—"}
                      <small>{x.email}</small>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="link-button"
                          onClick={() => {
                            setClientFilter(String(x.id));
                            setPage("casos");
                          }}
                        >
                          Ver casos
                        </button>
                        <button
                          className="link-button"
                          onClick={() => {
                            setFileClient(x);
                            setModal("documentos");
                          }}
                        >
                          Documentos
                        </button>
                        {(isAdmin || actor.can_create_cases) && (
                          <button
                            className="link-button"
                            onClick={() => {
                              setNewCaseClient(x);
                              setModal("caso");
                            }}
                          >
                            Nuevo caso
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="link-button"
                            onClick={() => {
                              setEditClient(x);
                              setModal("cliente");
                            }}
                          >
                            Corregir datos
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
