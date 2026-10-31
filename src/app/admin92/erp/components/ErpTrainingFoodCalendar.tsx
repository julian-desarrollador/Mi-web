"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  formatWeekRangeLabel,
  mondayOfWeek,
  weekDates,
  dayShortLabel,
} from "@/app/admin92/erp/lib/erpAggregates";
import {
  MEAL_META,
  formatMinutesAsHm,
  isTrainingDone,
  normalizeFood,
  normalizeTraining,
  type ErpDayLog,
  type TrainingCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import {
  MONTH_NAMES,
  getMonthKeySafe,
  shiftDate,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;
const PLACES: Record<TrainingCategoryKey, string> = {
  gimnasio: "gimnasio",
  natacion: "natación",
  casa: "casa",
};

type View = "week" | "month";

type Props = {
  anchorDate: string;
  onClose: () => void;
};

function ymdFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function monthCells(anchor: string): { date: string; inMonth: boolean }[] {
  const [y, m] = getMonthKeySafe(anchor).split("-").map(Number);
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
    const last = cells[cells.length - 1].date;
    const [ly, lm, ld] = last.split("-").map(Number);
    const d = new Date(ly, lm - 1, ld + 1);
    cells.push({
      date: ymdFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      inMonth: false,
    });
  }
  return cells;
}

function datesFor(view: View, anchor: string): string[] {
  if (view === "week") return weekDates(mondayOfWeek(anchor));
  return monthCells(anchor).map((cell) => cell.date);
}

function pickSelected(current: string, dates: string[], anchor: string): string {
  if (dates.includes(current)) return current;
  const today = todayYmd();
  if (dates.includes(today)) return today;
  if (dates.includes(anchor)) return anchor;
  return dates[0] ?? anchor;
}

function dayMonth(ymd: string): string {
  const [, month, day] = ymd.split("-");
  return `${Number(day)}/${Number(month)}`;
}

function dayMarks(log: ErpDayLog | undefined): { training: boolean; food: boolean } {
  if (!log) return { training: false, food: false };
  const training = normalizeTraining(log.training);
  const food = normalizeFood(log.food);
  return {
    training: (Object.keys(training) as TrainingCategoryKey[]).some((key) =>
      isTrainingDone(training[key]),
    ),
    food: MEAL_META.some(({ key }) => food[key].done),
  };
}

type TrainingDetail = {
  key: TrainingCategoryKey;
  headline: string;
  notes: string[];
};

type MealDetail = {
  key: string;
  label: string;
  value: string;
};

function splitNotes(notes: string): string[] {
  return notes
    .split(/\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function describeDay(
  log: ErpDayLog | undefined,
): { training: TrainingDetail[]; meals: MealDetail[] } | null {
  if (!log) return null;
  const training = normalizeTraining(log.training);
  const food = normalizeFood(log.food);
  const trainingLines = (Object.keys(PLACES) as TrainingCategoryKey[]).flatMap((key) => {
    const session = training[key];
    if (!isTrainingDone(session)) return [];
    const duration = formatMinutesAsHm(session.minutes);
    const headline = duration ? `${duration} en ${PLACES[key]}` : `en ${PLACES[key]}`;
    const notes = splitNotes(session.notes ?? "");
    return [{ key, headline, notes }];
  });
  const meals = MEAL_META.flatMap(({ key, label }) => {
    const meal = food[key];
    if (!meal.done) return [];
    return [{ key, label, value: meal.quality != null ? String(meal.quality) : "hecha" }];
  });
  if (trainingLines.length === 0 && meals.length === 0) return null;
  return { training: trainingLines, meals };
}

export default function ErpTrainingFoodCalendar({ anchorDate, onClose }: Props) {
  const [view, setView] = useState<View>("week");
  const [cursor, setCursor] = useState(anchorDate);
  const [selected, setSelected] = useState(() =>
    pickSelected("", weekDates(mondayOfWeek(anchorDate)), anchorDate),
  );
  const [logs, setLogs] = useState<ErpDayLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const cells = useMemo(
    () => (view === "week" ? null : monthCells(cursor)),
    [view, cursor],
  );
  const dates = useMemo(() => datesFor(view, cursor), [view, cursor]);
  const from = dates[0];
  const to = dates[dates.length - 1];
  const byDate = useMemo(() => {
    const map = new Map<string, ErpDayLog>();
    for (const log of logs) map.set(log.date, log);
    return map;
  }, [logs]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  useEffect(() => {
    if (!from || !to) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/admin/erp-logs?from=${from}&to=${to}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { logs?: ErpDayLog[]; error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo cargar el calendario.");
        setLogs(data.logs ?? []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No se pudo cargar el calendario.");
        setLogs([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to]);

  const rangeLabel =
    view === "week"
      ? formatWeekRangeLabel(mondayOfWeek(cursor))
      : MONTH_NAMES[Number(getMonthKeySafe(cursor).split("-")[1]) - 1];

  const move = (delta: number) => {
    const nextCursor =
      view === "week"
        ? shiftDate(mondayOfWeek(cursor), delta * 7)
        : `${shiftMonth(getMonthKeySafe(cursor), delta)}-01`;
    setCursor(nextCursor);
    setSelected((current) => pickSelected(current, datesFor(view, nextCursor), nextCursor));
  };

  const switchView = (next: View) => {
    if (next === view) return;
    setView(next);
    setCursor(selected);
    setSelected((current) => pickSelected(current, datesFor(next, selected), selected));
  };

  const detail = describeDay(byDate.get(selected));
  const today = todayYmd();

  const dayButton = (date: string, inMonth: boolean) => {
    const marks = dayMarks(byDate.get(date));
    const active = date === selected;
    const bits = [
      marks.training ? "con entrenamiento" : "",
      marks.food ? "con comida" : "",
    ].filter(Boolean);
    return (
      <button
        key={date}
        type="button"
        onClick={() => setSelected(date)}
        aria-pressed={active}
        aria-label={`${dayShortLabel(date)} ${dayMonth(date)}${bits.length ? `, ${bits.join(" y ")}` : ""}`}
        className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-1 py-1.5 cursor-pointer ${
          active
            ? "border-[#1d4e89] bg-[#e4eef8]"
            : "border-[#c5d4e8] bg-white"
        } ${inMonth ? "" : "opacity-60"}`}
      >
        {view === "week" ? (
          <span className="text-[11px] font-semibold text-[#3d5270]">{dayShortLabel(date)}</span>
        ) : null}
        <span
          className={`text-sm font-semibold ${
            date === today ? "text-[#1d4e89]" : "text-[#0f2744]"
          }`}
        >
          {Number(date.slice(8))}
        </span>
        <span className="flex h-2 items-center gap-1">
          {marks.training ? (
            <span className="h-2 w-2 rounded-full bg-[#1d4e89]" aria-hidden />
          ) : null}
          {marks.food ? (
            <span className="h-2 w-2 rounded-full bg-[#c2410c]" aria-hidden />
          ) : null}
        </span>
      </button>
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="erp-training-food-title"
        className="flex max-h-[min(40rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#c5d4e8] bg-white p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id="erp-training-food-title" className="text-lg font-semibold text-[#0f2744]">
            Entrenamiento y comidas
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-[#3d5270] transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-[#c5d4e8] bg-white p-0.5">
            {(["week", "month"] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => switchView(key)}
                className={`rounded-md px-3 py-1 text-xs font-semibold cursor-pointer ${
                  view === key ? "bg-[#1d4e89] text-white" : "bg-white text-[#0f2744]"
                }`}
              >
                {key === "week" ? "Semana" : "Mes"}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => move(-1)}
              aria-label={view === "week" ? "Semana anterior" : "Mes anterior"}
              className="rounded-lg p-1.5 text-[#3d5270] cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="min-w-[7.5rem] text-center text-sm font-semibold text-[#0f2744]">
              {rangeLabel}
            </p>
            <button
              type="button"
              onClick={() => move(1)}
              aria-label={view === "week" ? "Semana siguiente" : "Mes siguiente"}
              className="rounded-lg p-1.5 text-[#3d5270] cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-3 flex items-center gap-3 text-[11px] font-medium text-[#3d5270]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#1d4e89]" aria-hidden />
            Entrenamiento
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#c2410c]" aria-hidden />
            Comida
          </span>
        </div>

        {view === "month" ? (
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((label) => (
              <p key={label} className="text-center text-[11px] font-semibold text-[#3d5270]">
                {label}
              </p>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-7 gap-1">
          {view === "week"
            ? dates.map((date) => dayButton(date, true))
            : cells?.map((cell) => dayButton(cell.date, cell.inMonth))}
        </div>

        <div className="mt-4 min-h-16 overflow-y-auto border-t border-[#c5d4e8] pt-3">
          <p className="text-sm font-semibold text-[#0f2744]">
            {dayShortLabel(selected)} · {dayMonth(selected)}
          </p>
          {loading ? <p className="mt-1 text-sm text-[#3d5270]">Cargando…</p> : null}
          {error ? <p className="mt-1 text-sm text-[#9f1239]">{error}</p> : null}
          {!loading && !error && !detail ? (
            <p className="mt-1 text-sm text-[#3d5270]">Sin registro este día.</p>
          ) : null}
          {!loading && detail && detail.training.length > 0 ? (
            <div className="mt-2 space-y-2">
              {detail.training.map((line) => (
                <div
                  key={line.key}
                  className="rounded-xl border border-[#c5d4e8] border-l-4 border-l-[#1d4e89] bg-white px-3 py-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1d4e89]">
                    Entrenamiento
                  </p>
                  <p className="mt-0.5 text-sm font-semibold text-[#0f2744]">{line.headline}</p>
                  {line.notes.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {line.notes.map((note, index) => (
                        <span
                          key={`${index}-${note}`}
                          className="rounded-lg bg-[#e4eef8] px-2 py-1 text-xs font-medium text-[#0f2744]"
                        >
                          {note}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
          {!loading && detail && detail.meals.length > 0 ? (
            <div className="mt-2 rounded-xl border border-[#c5d4e8] border-l-4 border-l-[#c2410c] bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#c2410c]">
                Comidas
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {detail.meals.map((meal) => (
                  <span
                    key={meal.key}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#c5d4e8] bg-white px-2 py-1 text-xs font-medium text-[#0f2744]"
                  >
                    {meal.label}
                    <span className="rounded-md bg-[#c2410c] px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {meal.value}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        </div>
      </article>
    </div>,
    document.body,
  );
}
