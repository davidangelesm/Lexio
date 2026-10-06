import { Field, Form } from "../../../components/ui/index";
import type { LexioState } from "../../../hooks/useLexio";
import { casesService } from "../../../services/cases";
import { num, str } from "../../../utils/form";
import { localDate } from "../../../utils/format";

type Props = Pick<
  LexioState,
  "setModal" | "setSelected" | "users" | "isAdmin"
> & {
  actor: NonNullable<LexioState["actor"]>;
  newCaseClient: NonNullable<LexioState["newCaseClient"]>;
};
export default function CreateCaseForm({
  newCaseClient,
  setModal,
  setSelected,
  actor,
  users,
  isAdmin,
}: Props) {
  return (
    <Form
      submit={async (f) => {
        const result = await casesService.create({
          client_id: newCaseClient.id,
          area: str(f, "area"),
          subject: str(f, "subject"),
          description: str(f, "description"),
          initial_stage: str(f, "initial_stage"),
          current_stage: str(f, "current_stage"),
          start_date: str(f, "start_date"),
          responsible_id: num(f, "responsible_id"),
          reference: str(f, "reference"),
        });
        setModal("");
        setSelected(result);
      }}
    >
      <p className="full notice">
        {newCaseClient.name} · {newCaseClient.code}
      </p>
      <Field label="Rama / área">
        <input name="area" required placeholder="Civil, penal, laboral…" />
      </Field>
      <Field label="Materia">
        <input name="subject" required />
      </Field>
      <Field label="Etapa de ingreso">
        <input name="initial_stage" required />
      </Field>
      <Field label="Etapa actual">
        <input name="current_stage" required />
      </Field>
      <Field label="Fecha de inicio">
        <input
          name="start_date"
          type="date"
          required
          defaultValue={localDate()}
        />
      </Field>
      <Field label="Responsable">
        <select name="responsible_id" required defaultValue={actor.id}>
          {users
            .filter((x) => x.active && (isAdmin || x.id === actor.id))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Expediente / referencia opcional">
        <input name="reference" />
      </Field>
      <div className="full">
        <Field label="Descripción breve">
          <textarea name="description" required />
        </Field>
      </div>
    </Form>
  );
}
