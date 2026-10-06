export function Empty({
  text = "Todavía no hay registros.",
}: {
  text?: string;
}) {
  return <div className="empty">{text}</div>;
}
