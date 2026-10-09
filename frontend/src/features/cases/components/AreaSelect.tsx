import type { ComponentProps } from "react";
import { isLegalArea, LEGAL_AREAS } from "../models/legalAreas";

export default function AreaSelect({
  defaultValue,
  required,
  ...props
}: ComponentProps<"select">) {
  const selected =
    typeof defaultValue === "string" && isLegalArea(defaultValue)
      ? defaultValue
      : "";
  return (
    <select
      {...props}
      required={required}
      defaultValue={props.value === undefined ? selected : undefined}
    >
      <option value="">
        {required ? "Selecciona una rama" : "Todas las ramas"}
      </option>
      {LEGAL_AREAS.map((area) => (
        <option key={area} value={area}>
          {area}
        </option>
      ))}
    </select>
  );
}
