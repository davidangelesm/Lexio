import { Archive, FolderOpen, Plus, Search } from "lucide-react";
import { Card, Empty, Field } from "../../components/ui";
import type { Case, Client, LegalArea, User } from "../../types";
import AreaSelect from "./components/AreaSelect";
type Props = {
  actor?: User;
  cases: Case[];
  clients: Client[];
  areas: LegalArea[];
  busy: boolean;
  search: string;
  setSearch: (value: string) => void;
  area: string;
  setArea: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  clientFilter: string;
  setClientFilter: (value: string) => void;
  load: () => Promise<void>;
  clearFilters: () => void;
  openCase: (id: number) => Promise<void>;
  create: () => void;
  isAdmin: boolean;
  initialArchived?: boolean;
};
export default function CasesPage({
  actor,
  cases,
  clients,
  areas,
  busy,
  search,
  setSearch,
  area,
  setArea,
  status,
  setStatus,
  clientFilter,
  setClientFilter,
  load,
  clearFilters,
  openCase,
  create,
  isAdmin,
  initialArchived = false,
}: Props) {
  const archived = initialArchived || status === "archivados";
  const visibleCases = cases.filter((item) =>
    archived ? item.status !== "activo" : item.status === "activo",
  );
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">
            {archived ? "Archivo del estudio" : "Procesos del estudio"}
          </p>
          <h1>{archived ? "Casos archivados" : "Casos"}</h1>
          <p>
            {archived
              ? "Procesos concluidos o retirados del seguimiento activo."
              : "Consulta los procesos de cada cliente y su seguimiento."}
          </p>
        </div>
        <div className="actions">
          <button
            type="button"
            className={archived ? "primary" : "secondary"}
            onClick={() => setStatus(archived ? "" : "archivados")}
          >
            {archived ? <FolderOpen size={16} /> : <Archive size={16} />}
            {archived ? "Casos activos" : "Casos archivados"}
          </button>
          {(isAdmin || actor?.can_create_cases) && (
            <button className="primary" onClick={create}>
              <Plus size={16} />
              Nuevo caso
            </button>
          )}
        </div>
      </div>
      <Card>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <Field label="Buscar cliente o proceso">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nombre, código o proceso"
            />
          </Field>
          <Field label="Cliente">
            <select
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
            >
              <option value="">Todos los clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Rama del Derecho">
            <AreaSelect
              name="area_id"
              areas={areas}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </Field>
          <div className="actions">
            <button className="primary" disabled={busy}>
              <Search size={15} />
              Buscar
            </button>
            <button
              type="button"
              className="secondary"
              onClick={clearFilters}
              disabled={busy}
            >
              Limpiar filtros
            </button>
          </div>
        </form>
        {visibleCases.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo de proceso</th>
                  <th>Rama del Derecho</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleCases.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {(item.clients?.length
                        ? item.clients
                        : [item.client]
                      ).map((c) => (
                        <div key={c.id}>
                          <strong>{c.name}</strong>
                          <small>
                            {c.document_type} · {c.document_number}
                          </small>
                        </div>
                      ))}
                    </td>
                    <td>
                      {item.process_type}
                      {item.tracking_number && (
                        <small>Exp. {item.tracking_number}</small>
                      )}
                      <small>{item.initial_stage}</small>
                    </td>
                    <td>{item.area}</td>
                    <td>{item.responsible_name}</td>
                    <td>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() => void openCase(item.id)}
                      >
                        Ver caso
                      </button>
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
                ? "Cargando casos…"
                : archived
                  ? "No hay casos archivados."
                  : "No hay casos activos para estos filtros."
            }
          />
        )}
      </Card>
    </>
  );
}
