import {
  Bell,
  CalendarDays,
  ChartNoAxesCombined,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Scale,
  ShieldCheck,
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
    { key: "panel", label: "Panel del día", Icon: LayoutDashboard },
    { key: "clientes", label: "Clientes", Icon: Users },
    { key: "casos", label: "Casos", Icon: FolderOpen },
    { key: "alertas", label: "Centro de alertas", Icon: Bell },
    { key: "reportes", label: "Reportes", Icon: ChartNoAxesCombined },
    ...(isAdmin
      ? [{ key: "usuarios", label: "Administración", Icon: ShieldCheck }]
      : []),
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
              onClick={() => {
                onNavigate(key);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="profile">
          <strong>{actor.name}</strong>
          <small>
            {isAdmin ? "Administrador · finanzas" : "Equipo jurídico"}
          </small>
          <button onClick={onLogout}>
            <LogOut size={15} />
            Cerrar sesión
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            LEXCONTERRA GROUP /{" "}
            {caseCode || navigation.find((x) => x.key === page)?.label}
          </span>
          <div className="flex items-center gap-3">
            <CalendarDays size={15} />
            {dateLabel(localDate())}
            <span className="badge">
              {isAdmin ? "Administración" : "Acceso autorizado"}
            </span>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
