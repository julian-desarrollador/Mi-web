"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  mondayOfWeek,
  weekDates,
  type ErpPeriod,
} from "@/app/admin92/erp/lib/erpAggregates";
import {
  formatMonthLabel,
  getMonthKeySafe,
  MONTH_NAMES,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;

type Props = {
  period: ErpPeriod;
  value: string;
  rangeLabel: string;
  onChange: (ymd: string) => void;
  logsDates?: string[];
};

function ymdFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getMonthGrid(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  let startPad = first.getDay() - 1;
  if (startPad < 0) startPad = 6;

  const cells: { date: string; inMonth: boolean }[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, -i);
    cells.push({
      date: ymdFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: ymdFromParts(y, m, day), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [ly, lm, ld] = last.date.split("-").map(Number);
    const d = new Date(ly, lm - 1, ld + 1);
    cells.push({
      date: ymdFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      inMonth: false,
    });
  }

  return cells;
}

export default function ErpPeriodPicker({
  period,
  value,
  rangeLabel,
  onChange,
  logsDates = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => getMonthKeySafe(value));
  const [viewYear, setViewYear] = useState(() =>
    Number(getMonthKeySafe(value).slice(0, 4)),
  );
  const [hoverWeekMonday, setHoverWeekMonday] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const today = todayYmd();
  const logsSet = useMemo(() => new Set(logsDates), [logsDates]);
  const selectedWeek = useMemo(
    () => new Set(weekDates(mondayOfWeek(value))),
    [value],
  );
  const selectedMonth = getMonthKeySafe(value);

  useEffect(() => {
    if (!open) return;
    setViewMonth(getMonthKeySafe(value));
    setViewYear(Number(getMonthKeySafe(value).slice(0, 4)));
    setHoverWeekMonday(null);
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || rootRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const grid = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);

  const selectDay = (ymd: string) => {
    if (period === "week") {
      onChange(mondayOfWeek(ymd));
    } else {
      onChange(ymd);
    }
    setOpen(false);
  };

  const selectMonth = (ym: string) => {
    onChange(`${ym}-01`);
    setOpen(false);
  };

  const goToday = () => {
    const t = todayYmd();
    if (period === "month") onChange(`${getMonthKeySafe(t)}-01`);
    else if (period === "week") onChange(mondayOfWeek(t));
    else onChange(t);
    setOpen(false);
  };

  const navPrev = () => {
    if (period === "month") setViewYear((y) => y - 1);
    else setViewMonth((m) => shiftMonth(m, -1));
  };

  const navNext = () => {
    if (period === "month") setViewYear((y) => y + 1);
    else setViewMonth((m) => shiftMonth(m, 1));
  };

  const headerLabel =
    period === "month" ? String(viewYear) : formatMonthLabel(viewMonth);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm font-medium text-slate-700 transition"
      >
        <Calendar className="h-4 w-4 text-slate-400" />
        <span className="max-w-[11rem] truncate sm:max-w-none">{rangeLabel}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Elegir período"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(20rem,calc(100vw-2rem))] origin-top-right rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.16)]"
          style={{
            animation: "erpPeriodPickerIn 160ms ease-out",
          }}
        >
          <style>{`
            @keyframes erpPeriodPickerIn {
              from { opacity: 0; transform: translateY(-6px) scale(0.98); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>

          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={navPrev}
              aria-label={period === "month" ? "Año anterior" : "Mes anterior"}
              className="rounded-lg p-1.5 text-slate-500 transition cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold tracking-tight text-slate-950">
              {headerLabel}
            </p>
            <button
              type="button"
              onClick={navNext}
              aria-label={period === "month" ? "Año siguiente" : "Mes siguiente"}
              className="rounded-lg p-1.5 text-slate-500 transition cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {period === "month" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTH_NAMES.map((name, index) => {
                const ym = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
                const selected = ym === selectedMonth;
                const isCurrent = ym === getMonthKeySafe(today);
                return (
                  <button
                    key={ym}
                    type="button"
                    onClick={() => selectMonth(ym)}
                    className={`cursor-pointer rounded-xl px-2 py-3 text-center text-sm font-semibold transition ${
                      selected
                        ? "bg-blue-600 text-white shadow-sm"
                        : isCurrent
                          ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
                          : "text-slate-700"
                    }`}
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <div className="mb-1.5 grid grid-cols-7 gap-0.5">
                {WEEKDAYS.map((d) => (
                  <div
                    key={d}
                    className="py-1 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400"
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {grid.map((cell) => {
                  const dayNum = Number(cell.date.slice(8, 10));
                  const weekMon = mondayOfWeek(cell.date);
                  const inSelectedWeek =
                    period === "week" && selectedWeek.has(cell.date);
                  const inHoverWeek =
                    period === "week" && hoverWeekMonday === weekMon;
                  const isSelectedDay =
                    period === "day" && cell.date === value;
                  const isToday = cell.date === today;
                  const hasLog = logsSet.has(cell.date);

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => selectDay(cell.date)}
                      onMouseEnter={() => {
                        if (period === "week") setHoverWeekMonday(weekMon);
                      }}
                      onMouseLeave={() => {
                        if (period === "week") setHoverWeekMonday(null);
                      }}
                      className={`relative flex h-9 cursor-pointer flex-col items-center justify-center rounded-lg text-sm font-semibold transition ${
                        isSelectedDay
                          ? "bg-blue-600 text-white shadow-sm"
                          : period === "week" && inSelectedWeek
                            ? cell.inMonth
                              ? "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200/70"
                              : "bg-blue-50/80 text-blue-500 ring-1 ring-inset ring-blue-100"
                            : inHoverWeek
                              ? "bg-slate-50 text-blue-700"
                              : !cell.inMonth
                                ? "text-slate-300"
                                : isToday
                                  ? "text-blue-700 ring-1 ring-blue-200"
                                  : "text-slate-800"
                      }`}
                    >
                      {dayNum}
                      {hasLog && (
                        <span
                          className={`absolute bottom-1 h-1 w-1 rounded-full ${
                            isSelectedDay ? "bg-white/90" : "bg-blue-500"
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
            <p className="text-[11px] font-medium text-slate-400">
              {period === "day"
                ? "Elegí un día"
                : period === "week"
                  ? "Elegí una semana"
                  : "Elegí un mes"}
            </p>
            <button
              type="button"
              onClick={goToday}
              className="cursor-pointer rounded-lg bg-slate-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition"
            >
              Hoy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
