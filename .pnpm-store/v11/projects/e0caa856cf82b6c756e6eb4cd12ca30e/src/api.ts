const base = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(
  /\/$/,
  "",
);
let accessToken = "";
export function setToken(value: string): void {
  accessToken = value;
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data: {
      detail?: string | { msg: string; loc: (string | number)[] }[];
    } = await response.json().catch(() => ({}));
    if (response.status === 401 && accessToken) {
      setToken("");
      window.dispatchEvent(new Event("lexio-session-expired"));
    }
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : Array.isArray(data.detail)
          ? data.detail
              .map((x) => `${x.loc.slice(1).join(".")}: ${x.msg}`)
              .join(" · ")
          : `Error ${response.status}`,
    );
  }
  return response.json() as Promise<T>;
}
export function query(values: Record<string, string>): string {
  return new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== ""),
  ).toString();
}
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
