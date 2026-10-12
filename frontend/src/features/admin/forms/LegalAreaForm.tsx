import { Field, Form } from "../../../components/ui";
import type { LexioState } from "../../../hooks/useLexio";
import { legalAreasService } from "../../../services/legalAreas";
import { str } from "../../../utils/form";

type Props = Pick<LexioState, "done">;
export default function LegalAreaForm({ done }: Props) {
  return (
    <Form
      label="Agregar rama"
      submit={async (data) => {
        const name = str(data, "name").trim();
        if (!name) throw new Error("Ingresa el nombre de la rama de derecho.");
        await legalAreasService.create(name);
        await done();
      }}
    >
      <Field label="Nombre de la rama de derecho">
        <input name="name" required maxLength={80} autoFocus />
      </Field>
      <p className="full muted text-xs">
        La nueva rama estará disponible al registrar y filtrar casos del
        estudio.
      </p>
    </Form>
  );
}
