import type { ReactNode } from "react";
import { Badge, Card, Empty } from "../../../components/ui/index";
import type { Case } from "../../../types/index";
import { dateLabel } from "../../../utils/format";
import type { ReportsState } from "../hooks/useReports";

type Props = Pick<
  ReportsState,
  "setDetailFilter" | "detailFilter" | "openCase" | "userName"
> & {
  operational: NonNullable<ReportsState["operational"]>;
  caseRows: (list: Case[]) => ReactNode;
};
export default function OperationalReport({
  operational,
  setDetailFilter,
  detailFilter,
  caseRows,
  openCase,
  userName,
}: Props) {
  return (
    <>
      <Card>
        <h2>Casos únicos por rama</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Área</th>
                <th>Total</th>
                <th>Activos</th>
                <th>Concluidos</th>
                <th>Suspendidos</th>
              </tr>
            </thead>
            <tbody>
              {operational.areas.map((x) => (
                <tr key={x.area}>
                  <td>{x.area}</td>
                  {(
                    ["total", "activo", "concluido", "suspendido"] as const
                  ).map((k) => (
                    <td key={k}>
                      <button
                        className="link-button"
                        onClick={() => {
                          setDetailFilter({
                            area: x.area,
                            status: k === "total" ? "" : k,
                          });
                          document
                            .getElementById(`area-${x.area}`)
                            ?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        {x[k]}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td>TOTAL</td>
                {(["total", "activo", "concluido", "suspendido"] as const).map(
                  (k) => (
                    <td key={k}>
                      {operational.areas.reduce((s, x) => s + x[k], 0)}
                    </td>
                  ),
                )}
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      {operational.areas.map((x) => (
        <Card key={x.area}>
          <div id={`area-${x.area}`}>
            <h2>
              {x.area} · detalle de casos{" "}
              {detailFilter?.area === x.area && detailFilter.status
                ? `· ${detailFilter.status}`
                : ""}
            </h2>
            {caseRows(
              operational.cases.filter(
                (c) =>
                  c.area === x.area &&
                  (!detailFilter ||
                    detailFilter.area !== x.area ||
                    !detailFilter.status ||
                    c.status === detailFilter.status),
              ),
            )}
          </div>
        </Card>
      ))}
      <Card>
        <h2>Actuaciones</h2>
        {!operational.entries.length ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente / caso</th>
                  <th>Actuación</th>
                  <th>Fecha real</th>
                  <th>Registrador</th>
                </tr>
              </thead>
              <tbody>
                {operational.entries.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => openCase(x.case_id)}
                      >
                        {x.case_code}
                      </button>
                      <small>
                        {x.client?.name} · {x.client?.code}
                      </small>
                    </td>
                    <td>{x.description}</td>
                    <td>{dateLabel(x.action_date)}</td>
                    <td>{userName(x.registered_by)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card>
        <h2>Vencimientos y atención</h2>
        {!operational.tasks.length ? (
          <Empty />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente / caso</th>
                  <th>Tarea</th>
                  <th>Responsable</th>
                  <th>Vencimiento</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {operational.tasks.map((x) => (
                  <tr key={x.id}>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => openCase(x.case_id)}
                      >
                        {x.case_code}
                      </button>
                      <small>{x.client?.name}</small>
                    </td>
                    <td>{x.description}</td>
                    <td>{userName(x.responsible_id)}</td>
                    <td>{dateLabel(x.due_date)}</td>
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
