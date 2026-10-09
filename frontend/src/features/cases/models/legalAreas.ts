export const LEGAL_AREAS = [
  "Civil",
  "Penal",
  "Laboral",
  "Tributario",
  "Derecho corporativo",
  "Constitucional",
  "Familia",
  "Familia – Civil",
  "Administrativo",
  "Conciliación extrajudicial",
  "Fiscalía",
] as const;

export type LegalArea = (typeof LEGAL_AREAS)[number];

export function isLegalArea(value: string): value is LegalArea {
  return LEGAL_AREAS.some((area) => area === value);
}

export function legalArea(value: string): LegalArea {
  if (!isLegalArea(value)) throw new Error("Selecciona una rama del listado.");
  return value;
}
