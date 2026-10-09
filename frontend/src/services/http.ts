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
  const requestToken = accessToken;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data: {
      detail?: string | { msg: string; loc: (string | number)[] }[];
    } = await response.json().catch(() => ({}));
    if (
      response.status === 401 &&
      requestToken &&
      requestToken === accessToken
    ) {
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
