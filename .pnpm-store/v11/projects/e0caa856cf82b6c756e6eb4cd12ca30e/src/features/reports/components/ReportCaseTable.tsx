import { Badge } from "../../../components/ui/index";
import type { ReportsState } from "../../../features/reports/hooks/useReports";
import type { Case } from "../../../types/index";

type Props = Pick<ReportsState, "openCase" | "userName"> & { list: Case[] };
export default function ReportCaseTable({ list, openCase, userName }: Props) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Cliente / documento</th>
            <th>Caso</th>
            <th>Materia / etapa</th>
            <th>Responsable</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {list.map((x) => (
            <tr key={x.id}>
              <td>
                {x.client.name}
                <small>{x.client.code}</small>
              </td>
              <td>
                <button className="link-button" onClick={() => openCase(x.id)}>
                  {x.code}
                </button>
              </td>
              <td>
                {x.subject}
                <small>{x.current_stage}</small>
              </td>
              <td>{userName(x.responsible_id)}</td>
              <td>
                <Badge>{x.status}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
