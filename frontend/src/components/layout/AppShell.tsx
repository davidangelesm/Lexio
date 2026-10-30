import {
  ChartNoAxesCombined,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Scale,
  Settings,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import type { User } from "../../types";
import { dateLabel, localDate } from "../../utils/format";
type Props = {
  actor: User;
  page: string;
  caseCode?: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  children: ReactNode;
};
export default function AppShell({
  actor,
  page,
  caseCode,
  onNavigate,
  onLogout,
  children,
}: Props) {
  const isAdmin = actor.role === "admin";
  const navigation = [
    { key: "inicio", label: "Inicio", Icon: LayoutDashboard },
    { key: "clientes", label: "Clientes", Icon: Users },
    { key: "casos", label: "Casos", Icon: ClipboardList },
    { key: "reportes", label: "Reportes", Icon: ChartNoAxesCombined },
  ];
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <Scale size={30} />
          <span>
            Lexio<small>CONTROL JURÍDICO</small>
          </span>
        </div>
        <p className="eyebrow px-3 mb-4">Espacio de trabajo</p>
        <nav>
          {navigation.map(({ key, label, Icon }) => (
            <button
              title={label}
              key={key}
              className={page === key ? "active" : ""}
              onClick={() => onNavigate(key)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="profile">
          <div className="profile-row">
            <div className="profile-info">
              <strong>{actor.name}</strong>
              <small>{isAdmin ? "Administrador" : "Asistente"}</small>
            </div>
            <button
              type="button"
              title="Configuración"
              aria-label="Configuración"
              className={`profile-settings ${page === "usuarios" ? "active" : ""}`}
              onClick={() => onNavigate("usuarios")}
            >
              <Settings size={18} />
            </button>
          </div>
          <button className="secondary" onClick={onLogout}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            {" "}
            {caseCode ||
              (page === "usuarios"
                ? "Configuración"
                : navigation.find((x) => x.key === page)?.label)}
          </span>
          <span>{dateLabel(localDate())}</span>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
