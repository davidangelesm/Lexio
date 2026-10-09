import { Plus, Search } from "lucide-react";
import { Badge, Card, Empty, Field } from "../../components/ui";
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
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Procesos del estudio</p>
          <h1>Casos</h1>
          <p>Consulta los procesos de cada cliente y su seguimiento.</p>
        </div>
        {(isAdmin || actor?.can_create_cases) && (
          <button className="primary" onClick={create}>
            <Plus size={16} />
            Nuevo caso
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
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="activo">Activo</option>
              <option value="concluido">Concluido</option>
            </select>
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
        {cases.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Tipo de proceso</th>
                  <th>Rama del Derecho</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.client.name}</strong>
                      <small>{item.client.code}</small>
                    </td>
                    <td>
                      {item.process_type}
                      <small>{item.initial_stage}</small>
                    </td>
                    <td>{item.area}</td>
                    <td>
                      <Badge>
                        {item.status === "activo" ? "Activo" : "Concluido"}
                      </Badge>
                    </td>
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
            text={busy ? "Cargando casos…" : "No hay casos para estos filtros."}
          />
        )}
      </Card>
    </>
  );
}
