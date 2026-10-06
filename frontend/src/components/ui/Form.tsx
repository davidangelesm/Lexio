import { LoaderCircle } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

export function Form({
  children,
  submit,
  label = "Guardar",
}: {
  children: ReactNode;
  submit: (data: FormData) => Promise<void>;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await submit(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={send}>
      <fieldset disabled={busy}>
        <div className="form-grid">{children}</div>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <footer>
          <button className="primary" type="submit">
            {busy && <LoaderCircle size={16} className="animate-spin" />}
            {busy ? "Guardando…" : label}
          </button>
        </footer>
      </fieldset>
    </form>
  );
}
