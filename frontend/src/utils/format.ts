export const localDate = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const money = (value: string | number | undefined): string =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number(value || 0),
  );
export const dateLabel = (value: string | null | undefined): string =>
  value
    ? new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeZone: "America/Lima",
      }).format(
        new Date(value.length === 10 ? `${value}T12:00:00-05:00` : `${value}Z`),
      )
    : "Pendiente de evento";
