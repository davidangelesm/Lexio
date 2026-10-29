import { useState } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import type { Alert, CaseTab } from "../../../types";
import { localDate, timeLabel } from "../../../utils/format";

export type CalendarView = "week" | "month";

type Props = {
  data: Alert[];
  openCase: (id: number, tab?: CaseTab) => Promise<void>;
  initialView?: CalendarView;
  initialDate?: string;
};

const DAY_NAMES_SHORT = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0));
}

function toISODate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISODate(d);
}

function addMonths(iso: string, months: number): string {
  const d = parseISODate(iso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const maxDay = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, maxDay));
  return toISODate(d);
}

function startOfWeekMonday(iso: string): string {
  const d = parseISODate(iso);
  const dow = d.getUTCDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return toISODate(d);
}

function getWeekDays(anchorIso: string): string[] {
  const start = startOfWeekMonday(anchorIso);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

function getMonthGridDays(anchorIso: string): { iso: string; inMonth: boolean }[] {
  const d = parseISODate(anchorIso);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const firstDayIso = toISODate(new Date(Date.UTC(year, month, 1, 12, 0, 0)));
  const lastDayDate = new Date(Date.UTC(year, month + 1, 0, 12, 0, 0));
  const lastDayIso = toISODate(lastDayDate);

  const startIso = startOfWeekMonday(firstDayIso);
  const lastDow = lastDayDate.getUTCDay();
  const endDiff = lastDow === 0 ? 0 : 7 - lastDow;
  const endIso = addDays(lastDayIso, endDiff);

  const result: { iso: string; inMonth: boolean }[] = [];
  let cursor = startIso;
  while (cursor <= endIso && result.length < 42) {
    const cursorDate = parseISODate(cursor);
    result.push({
      iso: cursor,
      inMonth: cursorDate.getUTCMonth() === month,
    });
    cursor = addDays(cursor, 1);
  }
  return result;
}

function formatPeriodTitle(anchorIso: string, view: CalendarView): string {
  const monthFmt = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const shortMonthFmt = new Intl.DateTimeFormat("es-PE", {
    month: "short",
    timeZone: "UTC",
  });
  if (view === "month") {
    const label = monthFmt.format(parseISODate(anchorIso));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }
  const days = getWeekDays(anchorIso);
  const first = parseISODate(days[0]);
  const last = parseISODate(days[6]);
  if (first.getUTCMonth() === last.getUTCMonth()) {
    const label = monthFmt.format(first);
    return `${first.getUTCDate()} – ${last.getUTCDate()} de ${label}`;
  }
  const m1 = shortMonthFmt.format(first).replace(".", "");
  const m2 = shortMonthFmt.format(last).replace(".", "");
  return `${first.getUTCDate()} ${m1} – ${last.getUTCDate()} ${m2} ${last.getUTCFullYear()}`;
}

function parseHour(value?: string | null): number | null {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const h = Number(value.slice(0, 2));
  return Number.isInteger(h) && h >= 0 && h <= 23 ? h : null;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return "12 a. m.";
  if (hour < 12) return `${hour} a. m.`;
  if (hour === 12) return "12 p. m.";
  return `${hour - 12} p. m.`;
}

function chipTone(item: Alert): string {
  if (item.urgent) return "gcal-chip-urgent";
  return item.kind === "otro" ? "gcal-chip-other" : "gcal-chip-legal";
}

export default function AlertCalendar({
  data,
  openCase,
  initialView = "week",
  initialDate,
}: Props) {
  const today = localDate();
  const defaultAnchor = initialDate || today;

  const [view, setView] = useState<CalendarView>(initialView);
  const [anchorDate, setAnchorDate] = useState<string>(defaultAnchor);

  const weekDays = getWeekDays(anchorDate);
  const monthDays = getMonthGridDays(anchorDate);

  const timedHours = data
    .map((item) => parseHour(item.target_time))
    .filter((h): h is number => h !== null);
  const minHour = Math.min(7, ...(timedHours.length ? timedHours : [7]));
  const maxHour = Math.max(20, ...(timedHours.length ? timedHours : [20]));
  const hours = Array.from(
    { length: maxHour - minHour + 1 },
    (_, idx) => minHour + idx,
  );

  function navigate(step: number) {
    setAnchorDate((current) =>
      view === "week" ? addDays(current, step * 7) : addMonths(current, step),
    );
  }

  return (
    <div className="gcal" aria-label="Calendario de alertas">
      <div className="gcal-toolbar">
        <div className="gcal-toolbar-left">
          <button
            type="button"
            className="secondary gcal-today-btn"
            onClick={() => setAnchorDate(today)}
          >
            Hoy
          </button>
          <div className="gcal-nav-arrows" role="group" aria-label="Navegar periodo">
            <button
              type="button"
              className="icon-button gcal-nav-btn"
              aria-label="Periodo anterior"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              className="icon-button gcal-nav-btn"
              aria-label="Periodo siguiente"
              onClick={() => navigate(1)}
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <h3 className="gcal-period-title">
            <CalendarIcon size={18} className="gcal-title-icon" />
            {formatPeriodTitle(anchorDate, view)}
          </h3>
        </div>

        <div className="gcal-toolbar-right">
          <div className="gcal-legend" aria-hidden="true">
            <span className="gcal-legend-item">
              <i className="gcal-dot gcal-dot-legal" /> Legal
            </span>
            <span className="gcal-legend-item">
              <i className="gcal-dot gcal-dot-other" /> Otro
            </span>
            <span className="gcal-legend-item">
              <i className="gcal-dot gcal-dot-urgent" /> Urgente
            </span>
          </div>
          <div className="gcal-view-switch" role="group" aria-label="Vista del calendario">
            <button
              type="button"
              className={view === "week" ? "gcal-switch-btn active" : "gcal-switch-btn"}
              onClick={() => setView("week")}
            >
              Semana
            </button>
            <button
              type="button"
              className={view === "month" ? "gcal-switch-btn active" : "gcal-switch-btn"}
              onClick={() => setView("month")}
            >
              Mes
            </button>
          </div>
        </div>
      </div>

      {view === "week" ? (
        <div className="gcal-week-wrap">
          <div className="gcal-week-header">
            <div className="gcal-gutter-head">Hora</div>
            {weekDays.map((iso, index) => {
              const dayNumber = parseISODate(iso).getUTCDate();
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  className={
                    isToday ? "gcal-day-head gcal-day-head-today" : "gcal-day-head"
                  }
                >
                  <span className="gcal-day-name">{DAY_NAMES_SHORT[index]}</span>
                  <span
                    className={
                      isToday ? "gcal-day-num gcal-day-num-today" : "gcal-day-num"
                    }
                  >
                    {dayNumber}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="gcal-allday-row" data-section="all-day">
            <div className="gcal-gutter-label">Todo el día</div>
            {weekDays.map((iso) => {
              const allDayAlerts = data.filter(
                (item) =>
                  item.target_date === iso && parseHour(item.target_time) === null,
              );
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  data-date={iso}
                  className={
                    isToday
                      ? "gcal-allday-cell gcal-col-today"
                      : "gcal-allday-cell"
                  }
                >
                  {allDayAlerts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`gcal-chip gcal-chip-allday ${chipTone(item)}`}
                      onClick={() => void openCase(item.case_id, "bitacora")}
                      title={`${item.subject || item.description} — ${item.client_name} (${item.case_code})`}
                    >
                      <span className="gcal-chip-title">
                        {item.subject || item.description}
                      </span>
                      <span className="gcal-chip-meta">
                        {item.client_name} · {item.case_code}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>

          <div className="gcal-time-body" data-section="time-grid">
            {hours.map((hour) => (
              <div
                key={hour}
                className="gcal-hour-row"
                data-hour={String(hour).padStart(2, "0")}
              >
                <div className="gcal-gutter-hour">{formatHourLabel(hour)}</div>
                {weekDays.map((iso) => {
                  const slotAlerts = data
                    .filter(
                      (item) =>
                        item.target_date === iso &&
                        parseHour(item.target_time) === hour,
                    )
                    .sort((a, b) =>
                      (a.target_time || "").localeCompare(b.target_time || ""),
                    );
                  const isToday = iso === today;
                  return (
                    <div
                      key={`${iso}-${hour}`}
                      data-slot={`${iso}T${String(hour).padStart(2, "0")}`}
                      className={
                        isToday
                          ? "gcal-hour-cell gcal-col-today"
                          : "gcal-hour-cell"
                      }
                    >
                      {slotAlerts.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`gcal-chip gcal-chip-timed ${chipTone(item)}`}
                          onClick={() => void openCase(item.case_id, "bitacora")}
                          title={`${timeLabel(item.target_time)} · ${item.subject || item.description} — ${item.client_name} (${item.case_code})`}
                        >
                          <span className="gcal-chip-time">
                            <Clock size={12} /> {timeLabel(item.target_time)}
                          </span>
                          <span className="gcal-chip-title">
                            {item.subject || item.description}
                          </span>
                          <span className="gcal-chip-meta">
                            {item.client_name} · {item.case_code}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="gcal-month-wrap" data-section="month-grid">
          <div className="gcal-month-header">
            {DAY_NAMES_SHORT.map((name) => (
              <div key={name} className="gcal-month-weekday">
                {name}
              </div>
            ))}
          </div>
          <div className="gcal-month-grid">
            {monthDays.map(({ iso, inMonth }) => {
              const dayNumber = parseISODate(iso).getUTCDate();
              const isToday = iso === today;
              const dayAlerts = data
                .filter((item) => item.target_date === iso)
                .sort((a, b) => {
                  if (!a.target_time && b.target_time) return -1;
                  if (a.target_time && !b.target_time) return 1;
                  return (a.target_time || "").localeCompare(b.target_time || "");
                });

              return (
                <div
                  key={iso}
                  data-month-day={iso}
                  className={[
                    "gcal-month-cell",
                    !inMonth ? "gcal-month-cell-outside" : "",
                    isToday ? "gcal-month-cell-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="gcal-month-cell-head">
                    <span
                      className={
                        isToday
                          ? "gcal-day-num gcal-day-num-today"
                          : "gcal-day-num"
                      }
                    >
                      {dayNumber}
                    </span>
                  </div>
                  <div className="gcal-month-stack">
                    {dayAlerts.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className={`gcal-chip ${item.target_time ? "gcal-chip-timed-month" : "gcal-chip-allday"} ${chipTone(item)}`}
                        onClick={() => void openCase(item.case_id, "bitacora")}
                        title={`${item.target_time ? `${timeLabel(item.target_time)} · ` : ""}${item.subject || item.description} — ${item.client_name} (${item.case_code})`}
                      >
                        {item.target_time && (
                          <span className="gcal-chip-time-inline">
                            {timeLabel(item.target_time)}
                          </span>
                        )}
                        <span className="gcal-chip-title">
                          {item.subject || item.description}
                        </span>
                        <span className="gcal-chip-meta">
                          {item.client_name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

