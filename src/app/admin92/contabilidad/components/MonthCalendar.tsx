"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Settings, Timer } from "lucide-react";
import { formatMonthLabel, todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import type { CuotaTimerRow } from "@/app/admin92/contabilidad/lib/cuotaTimers";
import type { CalendarMarkers } from "@/app/admin92/contabilidad/lib/calendarMarkers";
import {
  CALENDAR_BORDER_LEGEND,
  CALENDAR_LEGEND,
  MARKER_COLORS,
} from "@/app/admin92/contabilidad/types";
import CuotaCalendarDot, {
  CalendarLegendBorder,
} from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import Desarrollos50Panel from "@/app/admin92/contabilidad/components/Desarrollos50Panel";
import { buildDesarrollo50CalendarDots } from "@/app/admin92/contabilidad/lib/desarrollos50";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const LEGEND_VISIBLE_KEY = "glomun-calendario-leyenda";

function readLegendVisible(): boolean {
  try {
    const v = localStorage.getItem(LEGEND_VISIBLE_KEY);
    return v === "1";
  } catch {
    return false;
  }
}

type Props = {
  month: string;
  selectedDate: string | null;
  markers: CalendarMarkers;
  cuotasDelMes?: number;
  /** Incrementar para forzar refresh de puntos/contador de desarrollos */
  desarrollosRefreshKey?: number;
  onDesarrollosAccountingChange?: () => void;
  onSelectDate: (date: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  cuotaTimersOpen?: boolean;
  onToggleCuotaTimers?: () => void;
  cuotaTimerRows?: CuotaTimerRow[];
  cuotaTimersLoading?: boolean;
  cuotaTimersError?: string;
};

function getDaysInMonth(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const daysInMonth = last.getDate();

  let startPad = first.getDay() - 1;
  if (startPad < 0) startPad = 6;

  const cells: { date: string; inMonth: boolean }[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, -i);
    cells.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({
      date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const lastCell = cells[cells.length - 1];
    const [ly, lm, ld] = lastCell.date.split("-").map(Number);
    const d = new Date(ly, lm - 1, ld + 1);
    cells.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      inMonth: false,
    });
  }

  return cells;
}

export default function MonthCalendar({
  month,
  selectedDate,
  markers,
  cuotasDelMes = 0,
  desarrollosRefreshKey = 0,
  onDesarrollosAccountingChange,
  onSelectDate,
  onPrevMonth,
  onNextMonth,
  cuotaTimersOpen = false,
  onToggleCuotaTimers,
  cuotaTimerRows = [],
  cuotaTimersLoading = false,
  cuotaTimersError = "",
}: Props) {
  const [clientToday, setClientToday] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [desarrollosOpen, setDesarrollosOpen] = useState(false);
  const [desarrollosCount, setDesarrollosCount] = useState(0);
  /** Markers de desarrollos activos (cobro + alerta viva en hoy) */
  const [desarrolloDots, setDesarrolloDots] = useState<
    { date: string; cambioPendiente: boolean }[]
  >([]);
  const hoursById = new Map(cuotaTimerRows.map((row) => [row.id, row]));

  useEffect(() => {
    setClientToday(todayYmd());
    setShowLegend(readLegendVisible());
  }, []);

  const refreshDesarrollosCount = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/desarrollos-50");
      const data = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(data.desarrollos) ? data.desarrollos : [];
      setDesarrollosCount(list.length);
      setDesarrolloDots(buildDesarrollo50CalendarDots(list, todayYmd()));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshDesarrollosCount();
  }, [refreshDesarrollosCount, desarrollosRefreshKey]);

  const handleDesarrollosAccountingChange = useCallback(() => {
    void refreshDesarrollosCount();
    onDesarrollosAccountingChange?.();
  }, [refreshDesarrollosCount, onDesarrollosAccountingChange]);

  const toggleLegend = () => {
    setShowLegend((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(LEGEND_VISIBLE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const cells = getDaysInMonth(month);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onPrevMonth}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
          aria-label="Mes anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h3 className="text-base font-semibold text-slate-900">{formatMonthLabel(month)}</h3>
        <button
          type="button"
          onClick={onNextMonth}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
          aria-label="Mes siguiente"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1 text-center text-xs font-medium text-slate-500">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }) => {
          const dayMarkers = markers[date];
          const isSelected = selectedDate === date;
          const isToday = clientToday !== null && date === clientToday;
          const hasCuotas = (dayMarkers?.cuotas.length ?? 0) > 0;
          const desarrollosDelDia = desarrolloDots.filter((d) => d.date === date);
          const hasDesarrollos = desarrollosDelDia.length > 0;
          const showDots =
            Boolean(dayMarkers?.inversion) || hasCuotas || hasDesarrollos;

          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectDate(date)}
              className={`flex min-h-[44px] sm:min-h-[52px] flex-col items-center justify-center rounded-lg border text-sm transition-colors cursor-pointer ${
                isSelected
                  ? "border-[#84b9ed] bg-[#84b9ed]/10 font-semibold text-slate-900"
                  : isToday
                    ? "border-[#84b9ed]/50 bg-slate-50 text-slate-900"
                    : inMonth
                      ? "border-transparent text-slate-900 hover:bg-slate-50"
                      : "border-transparent text-slate-300 hover:bg-slate-50/50"
              }`}
            >
              <span>{parseInt(date.slice(8, 10), 10)}</span>
              {showDots && (
                <span className="mt-0.5 flex max-w-full flex-wrap items-start justify-center gap-x-1 gap-y-0.5 px-0.5">
                  {dayMarkers?.inversion && (
                    <span
                      className="mt-0.5 h-1 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: MARKER_COLORS.inversion }}
                    />
                  )}
                  {dayMarkers?.cuotas.map((dot) => (
                    <span key={dot.id} className="flex flex-col items-center">
                      <CuotaCalendarDot estado={dot.estado} border={dot.border} />
                      {cuotaTimersOpen && (
                        <span className="flex flex-col items-center gap-0.5">
                          <span className="text-[10px] font-semibold leading-none text-slate-900">
                            {cuotaTimersLoading || cuotaTimersError
                              ? "…"
                              : (hoursById.get(dot.id)?.hoursLabel ?? "0:00 hs")}
                          </span>
                          {!cuotaTimersLoading &&
                          !cuotaTimersError &&
                          hoursById.get(dot.id)?.repartidoLabel ? (
                            <span className="text-[10px] font-semibold leading-none text-slate-900">
                              {hoursById.get(dot.id)?.repartidoLabel}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </span>
                  ))}
                  {desarrollosDelDia.map((d, idx) => (
                    <CuotaCalendarDot
                      key={`d50-${idx}`}
                      estado="pagada"
                      border={d.cambioPendiente ? "cambio" : "none"}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <div className={`flex items-start gap-2 ${showLegend ? "justify-between" : "justify-end"}`}>
          {showLegend && (
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                {CALENDAR_LEGEND.map(({ color, label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                    {label}
                  </span>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                {CALENDAR_BORDER_LEGEND.map(({ label }) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <CalendarLegendBorder
                      border={label.includes("Cambio") ? "cambio" : "stats"}
                      size="md"
                    />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="flex shrink-0 items-start gap-2">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-xs font-medium text-slate-600">
                {cuotasDelMes} cuota{cuotasDelMes === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setDesarrollosOpen((v) => !v)}
                aria-expanded={desarrollosOpen}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 hover:text-sky-900 cursor-pointer"
              >
                {desarrollosCount} desarrollo{desarrollosCount === 1 ? "" : "s"} 50%
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${desarrollosOpen ? "rotate-180" : ""}`}
                />
              </button>
            </div>
            <button
              type="button"
              onClick={toggleLegend}
              aria-label={showLegend ? "Ocultar referencias del calendario" : "Mostrar referencias del calendario"}
              aria-pressed={showLegend}
              title={showLegend ? "Ocultar referencias" : "Mostrar referencias"}
              className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                showLegend
                  ? "border-[#84b9ed]/40 bg-[#84b9ed]/10 text-[#4a7fb8] hover:bg-[#84b9ed]/20"
                  : "border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
            >
              <Settings className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleCuotaTimers}
              aria-label={cuotaTimersOpen ? "Ocultar horas de las cuotas" : "Ver horas de las cuotas"}
              aria-pressed={cuotaTimersOpen}
              title={cuotaTimersOpen ? "Ocultar horas de las cuotas" : "Ver horas de las cuotas"}
              className={`rounded-lg border p-2 transition-colors cursor-pointer ${
                cuotaTimersOpen
                  ? "border-[#1d4ed8] bg-[#1d4ed8] text-white"
                  : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              <Timer className="h-4 w-4" />
            </button>
          </div>
        </div>

        {cuotaTimersOpen && cuotaTimersError && (
          <p className="text-sm font-medium text-slate-900">{cuotaTimersError}</p>
        )}

        {desarrollosOpen && (
          <div className="rounded-lg border border-sky-200 bg-sky-50/50 p-2.5">
            <Desarrollos50Panel
              onCountChange={setDesarrollosCount}
              onAccountingChange={handleDesarrollosAccountingChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
