import type { ComponentProps } from "react";
import type { LegalArea } from "../../../types";

type Props = ComponentProps<"select"> & { areas: LegalArea[] };

export default function AreaSelect({
  defaultValue,
  required,
  areas,
  ...props
}: Props) {
  const selected =
    typeof defaultValue === "string" || typeof defaultValue === "number"
      ? (areas.find((area) => area.id === Number(defaultValue))?.id ?? "")
      : "";
  return (
    <select
      {...props}
      required={required}
      defaultValue={props.value === undefined ? selected : undefined}
    >
      <option value="">
        {required
          ? areas.length
            ? "Selecciona una rama"
            : "Sin ramas: el administrador debe configurar el catálogo."
          : "Todas las ramas"}
      </option>
      {areas.map((area) => (
        <option key={area.id} value={area.id}>
          {area.name}
        </option>
      ))}
    </select>
  );
}
