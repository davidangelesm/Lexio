export function query(values: Record<string, string>): string {
  return new URLSearchParams(
    Object.entries(values).filter(([, v]) => v !== ""),
  ).toString();
}
