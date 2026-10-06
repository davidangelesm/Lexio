import { Plus } from "lucide-react";
import { Badge, Card, Empty, Field } from "../../components/ui/index";
import type { LexioState } from "../../hooks/useLexio";

type Props = Pick<
  LexioState,
  | "isAdmin"
  | "setPage"
  | "load"
  | "area"
  | "setArea"
  | "status"
  | "setStatus"
  | "clientFilter"
  | "setClientFilter"
  | "busy"
  | "cases"
  | "openCase"
  | "userName"
> & { actor: NonNullable<LexioState["actor"]> };
export default function CasesPage({
  isAdmin,
  actor,
  setPage,
  load,
  area,
  setArea,
  status,
  setStatus,
  clientFilter,
  setClientFilter,
  busy,
  cases,
  openCase,
  userName,
}: Props) {
  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Cartera jurídica</p>
          <h1>Casos</h1>
          <p>Selecciona un caso para consultar su historia y módulos.</p>
        </div>
        {(isAdmin || actor.can_create_cases) && (
          <button className="primary" onClick={() => setPage("clientes")}>
            <Plus size={15} />
            Seleccionar cliente
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
          <Field label="Rama / área">
            <input value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
          <Field label="Estado">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Todos</option>
              {["activo", "suspendido", "concluido"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Field>
          <Field label="ID cliente">
            <input
              type="number"
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
            />
          </Field>
          <button className="primary" disabled={busy}>
            Filtrar
          </button>
        </form>
        {!cases.length ? (
          <Empty
            text={
              busy
                ? "Consultando…"
                : "No hay casos autorizados con estos filtros."
            }
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Caso / cliente</th>
                  <th>Rama y materia</th>
                  <th>Etapa</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => void openCase(x.id)}
                      >
                        {x.code} · {x.client.name}
                      </button>
                      <small>{x.client.code}</small>
                    </td>
                    <td>
                      {x.area}
                      <small>{x.subject}</small>
                    </td>
                    <td>{x.current_stage}</td>
                    <td>{userName(x.responsible_id)}</td>
                    <td>
                      <Badge>{x.status}</Badge>
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
