import { Plus, Search } from "lucide-react";
import { Card, Empty, Field } from "../../components/ui";
import type { Client, User } from "../../types";
type Props = {
  actor: User;
  clients: Client[];
  busy: boolean;
  search: string;
  setSearch: (value: string) => void;
  load: () => Promise<void>;
  create: () => void;
  edit: (client: Client) => void;
  viewCases: (client: Client) => void;
  newCase: (client: Client) => void;
};
export default function ClientsPage({
  actor,
  clients,
  busy,
  search,
  setSearch,
  load,
  create,
  edit,
  viewCases,
  newCase,
}: Props) {
  const isAdmin = actor.role === "admin";
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Datos del cliente</p>
          <h1>Clientes</h1>
          <p>Registra a cada cliente una sola vez y vincula sus casos.</p>
        </div>
        {(isAdmin || actor.can_create_clients) && (
          <button className="primary" onClick={create}>
            <Plus size={16} />
            Nuevo cliente
          </button>
        )}
      </div>
      <Card>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <Field label="Buscar cliente">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nombre, código o documento"
            />
          </Field>
          <button className="primary" disabled={busy}>
            <Search size={15} />
            Buscar
          </button>
        </form>
        {clients.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contacto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                      <small>{client.code}</small>
                    </td>
                    <td>
                      {client.document_type} · {client.document_number}
                    </td>
                    <td>
                      {client.phone || "Sin celular"}
                      <small>{client.email || "Sin correo"}</small>
                    </td>
                    <td>
                      <div className="actions">
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() => viewCases(client)}
                        >
                          Ver casos
                        </button>
                        {(isAdmin || actor.can_create_cases) && (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() => newCase(client)}
                          >
                            Nuevo caso
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            className="secondary"
                            disabled={busy}
                            onClick={() => edit(client)}
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
        ) : (
          <Empty
            text={
              busy
                ? "Cargando clientes…"
                : "No hay clientes para esta búsqueda."
            }
          />
        )}
      </Card>
    </>
  );
}
