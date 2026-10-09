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
        new Date(
          value.length === 10
            ? `${value}T12:00:00-05:00`
            : /(?:Z|[+-]\d{2}:\d{2})$/i.test(value)
              ? value
              : `${value}Z`,
        ),
      )
    : "Sin fecha";

export function dateTimeLabels(value: string): { date: string; time: string } {
  // Backend timestamps without an offset are stored as UTC.
  const timestamp = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`;
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return { date: "Sin fecha", time: "" };
  return {
    date: new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      dateStyle: "long",
    }).format(instant),
    time: new Intl.DateTimeFormat("es-PE", {
      timeZone: "America/Lima",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(instant),
  };
}
