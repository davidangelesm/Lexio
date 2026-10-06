import type { CaseWorkspaceState } from "../../../features/cases/hooks/useCaseWorkspace";

type Props = Pick<
  CaseWorkspaceState,
  "isAdmin" | "authorized" | "users" | "caseData" | "tasks" | "actor"
> & { value?: number };
export default function ResponsibleSelect({
  value,
  actor,
  isAdmin,
  authorized,
  users,
  caseData,
  tasks,
}: Props) {
  return (
    <select name="responsible_id" defaultValue={value ?? actor.id} required>
      {(isAdmin
        ? authorized
        : users.filter(
            (x) =>
              x.id === actor.id ||
              x.id === caseData.responsible_id ||
              tasks.some((t) => t.responsible_id === x.id),
          )
      ).map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </select>
  );
}
