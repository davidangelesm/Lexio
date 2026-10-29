import { Calendar, ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card, Empty, Field } from "../../components/ui";
import type { LegalArea, Report, ReportTotals } from "../../types";
import { localDate, money } from "../../utils/format";
import AreaSelect from "../cases/components/AreaSelect";

const MONTHS = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" },
];

const START_YEAR = 1990;
const END_YEAR = 2100;
const ALL_YEARS = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_, index) => String(START_YEAR + index),
);

function YearWheelPicker({
  value,
  currentYear,
  onChange,
}: {
  value: string;
  currentYear: number;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drumRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const targetYear = value || String(currentYear);
    const index = ALL_YEARS.indexOf(targetYear);
    if (index >= 0 && drumRef.current) {
      drumRef.current.scrollTop = index * 38;
    }
    function handleOutside(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleOutside);
    return () => window.removeEventListener("mousedown", handleOutside);
  }, [open, value, currentYear]);

  function stepYear(delta: number) {
    const base = value ? Number(value) : currentYear;
    const next = Math.min(END_YEAR, Math.max(START_YEAR, base + delta));
    onChange(String(next));
  }

  return (
    <div className="year-wheel-wrap" ref={wrapRef}>
      <input type="hidden" name="year" value={value} />
      <div className={`year-wheel-control${open ? " open" : ""}`}>
        <button
          type="button"
          className="year-wheel-trigger"
          aria-expanded={open}
          aria-label="Seleccionar año"
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="inline-flex items-center gap-2">
            <Calendar size={15} className="text-[#164e43]" />
            <span>{value || "Todos los años"}</span>
          </span>
          <ChevronDown size={15} className="text-[#566b64]" />
        </button>
        <div className="year-wheel-spinners">
          <button
            type="button"
            className="year-wheel-step"
            title="Año siguiente"
            aria-label="Año siguiente"
            onClick={() => stepYear(1)}
          >
            <ChevronUp size={13} />
          </button>
          <button
            type="button"
            className="year-wheel-step"
            title="Año anterior"
            aria-label="Año anterior"
            onClick={() => stepYear(-1)}
          >
            <ChevronDown size={13} />
          </button>
        </div>
      </div>
      {open && (
        <div className="year-wheel-popover" role="listbox" aria-label="Rueda de años">
          <div className="year-wheel-quick">
            <button
              type="button"
              className={!value ? "primary" : "secondary"}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Todos los años
            </button>
            <button
              type="button"
              className={value === String(currentYear) ? "primary" : "secondary"}
              onClick={() => {
                onChange(String(currentYear));
                setOpen(false);
              }}
            >
              Actual ({currentYear})
            </button>
          </div>
          <div className="year-wheel-stage">
            <div className="year-wheel-stage-fade-top" />
            <div className="year-wheel-stage-bar" />
            <div className="year-wheel-stage-fade-bottom" />
            <div className="year-wheel-drum" ref={drumRef}>
              {ALL_YEARS.map((yr) => {
                const isSelected = value
                  ? value === yr
                  : yr === String(currentYear);
                return (
                  <button
                    key={yr}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`year-wheel-item${isSelected ? " active" : ""}`}
                    onClick={() => {
                      onChange(yr);
                      setOpen(false);
                    }}
                  >
                    <span>{yr}</span>
                    {yr === String(currentYear) && (
                      <span className="year-wheel-item-tag">Actual</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type Props = {
  report?: Report;
  areas?: LegalArea[];
  area?: string;
  setArea?: (value: string) => void;
  month?: string;
  setMonth?: (value: string) => void;
  year?: string;
  setYear?: (value: string) => void;
  clearFilters?: () => void;
  isAdmin: boolean;
  busy: boolean;
  load: () => Promise<void>;
};
function metrics(value: ReportTotals, isAdmin: boolean) {
  return (
    <>
      <td>{value.total_cases}</td>
      <td>{value.active_cases}</td>
      <td>{value.concluded_cases}</td>
      <td>{value.withdrawn_cases}</td>
      {isAdmin && (
        <>
          <td>{money(value.fee)}</td>
          <td>{money(value.paid)}</td>
          <td>{money(value.balance)}</td>
          <td>{money(value.uncollectible)}</td>
        </>
      )}
    </>
  );
}
export default function Reports({
  report,
  areas = [],
  area,
  setArea,
  month,
  setMonth,
  year,
  setYear,
  clearFilters,
  isAdmin,
  busy,
  load,
}: Props) {
  const [localArea, setLocalArea] = useState("");
  const [localMonth, setLocalMonth] = useState("");
  const [localYear, setLocalYear] = useState("");
  const selectedArea = area ?? localArea;
  const selectedMonth = month ?? localMonth;
  const selectedYear = year ?? localYear;
  const currentYear = Number(localDate().slice(0, 4)) || 2026;

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Métricas del estudio</p>
          <h1>Reportes</h1>
          <p>Casos y resultados agrupados por Rama del Derecho.</p>
        </div>
        <button
          className="secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw size={15} />
          Actualizar
        </button>
      </div>
      <Card>
        <form
          className="filters"
          onSubmit={(event) => {
            event.preventDefault();
            void load();
          }}
        >
          <Field label="Rama del Derecho">
            <AreaSelect
              name="area_id"
              areas={areas}
              value={selectedArea}
              onChange={(e) =>
                setArea ? setArea(e.target.value) : setLocalArea(e.target.value)
              }
            />
          </Field>
          <Field label="Mes">
            <select
              name="month"
              value={selectedMonth}
              onChange={(e) =>
                setMonth
                  ? setMonth(e.target.value)
                  : setLocalMonth(e.target.value)
              }
            >
              <option value="">Todos los meses</option>
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Año">
            <YearWheelPicker
              value={selectedYear}
              currentYear={currentYear}
              onChange={(next) =>
                setYear ? setYear(next) : setLocalYear(next)
              }
            />
          </Field>
          <div className="actions">
            <button className="primary" disabled={busy}>
              <Search size={15} />
              Filtrar
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                if (clearFilters) {
                  clearFilters();
                } else {
                  setLocalArea("");
                  setLocalMonth("");
                  setLocalYear("");
                  void load();
                }
              }}
            >
              Limpiar filtros
            </button>
          </div>
        </form>
        {report && report.rows.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Rama del Derecho</th>
                  <th>Total casos</th>
                  <th>Activos</th>
                  <th>Concluidos</th>
                  <th>Retirados</th>
                  {isAdmin && (
                    <>
                      <th>Total facturado</th>
                      <th>Efectivo cobrado</th>
                      <th>Saldo exigible</th>
                      <th>Saldo incobrable</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.area}>
                    <td>{row.area}</td>
                    {metrics(row, isAdmin)}
                  </tr>
                ))}
                <tr className="totals-row">
                  <td>Total</td>
                  {metrics(report.totals, isAdmin)}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            text={
              busy ? "Cargando reportes…" : "No hay información para mostrar."
            }
          />
        )}
        {isAdmin && (
          <p className="muted text-sm mt-5 mb-0">
            Saldo exigible = honorarios pactados − abonos registrados − saldo
            incobrable. Las cuotas incobrables conservan su historial y se
            excluyen de las alertas de cobranza.
          </p>
        )}
      </Card>
    </>
  );
}
