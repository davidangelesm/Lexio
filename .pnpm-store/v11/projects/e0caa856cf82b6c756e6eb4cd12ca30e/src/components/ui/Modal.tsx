import { X } from "lucide-react";
import { type ReactNode } from "react";

export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="Cerrar"
            onClick={close}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
