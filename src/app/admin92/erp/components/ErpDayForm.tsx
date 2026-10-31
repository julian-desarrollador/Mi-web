"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  Dumbbell,
  FlaskConical,
  Home,
  LoaderCircle,
  Moon,
  Trash2,
  Waves,
  X,
} from "lucide-react";
import {
  dayShortLabel,
  mondayOfWeek,
  weekDates,
} from "@/app/admin92/erp/lib/erpAggregates";
import {
  emptyDayLog,
  emptyFood,
  emptyMeal,
  emptyTrainingSession,
  emptyWorkTimers,
  ENGLISH_FIXED_MINUTES,
  formatHoursAsHm,
  formatMinutesAsHm,
  MEAL_META,
  minutesBetweenTimes,
  NATACION_FIXED_MINUTES,
  normalizeFood,
  normalizeTraining,
  normalizeWork,
  normalizeWorkTimers,
  parseDurationToHours,
  parseDurationToMinutes,
  sumWorkHours,
  sumWorkTimerSeconds,
  WORK_CATEGORY_META,
  type ErpDayLog,
  type ErpTrainingSession,
  type MealKey,
  type TrainingCategoryKey,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import {
  formatSecondsAsClock,
  mergeWorkTimersPaste,
  parseWorkTimersPaste,
  type ParseWorkTimersPasteResult,
} from "@/app/admin92/erp/lib/parseWorkTimersPaste";
import { formatLocalDate } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  selectedDate: string;
  onSelectedDateChange: (date: string) => void;
  dayLogs: ErpDayLog[];
  onSave: (log: ErpDayLog) => Promise<ErpDayLog>;
  onDelete: (date: string) => Promise<void>;
  onClose: () => void;
  loading: boolean;
  saving: boolean;
  saveError: string | null;
};

const trainingMeta: {
  key: TrainingCategoryKey;
  label: string;
  icon: typeof Dumbbell;
}[] = [
  { key: "gimnasio", label: "Gimnasio", icon: Dumbbell },
  { key: "natacion", label: "Natación", icon: Waves },
  { key: "casa", label: "En casa", icon: Home },
];

function cloneLog(log: ErpDayLog): ErpDayLog {
  const training = normalizeTraining(log.training);
  const food = normalizeFood(log.food ?? emptyFood());
  const workTimers = normalizeWorkTimers(log.workTimers ?? emptyWorkTimers());
  return {
    ...log,
    alarm: { ...log.alarm },
    work: normalizeWork(log.work),
    workTimers: {
      software: [...workTimers.software],
      saas: [...workTimers.saas],
      planificacion: [...workTimers.planificacion],
      branding: [...workTimers.branding],
      itNews: [...workTimers.itNews],
      stremear: [...workTimers.stremear],
    },
    training: {
      gimnasio: { ...training.gimnasio },
      natacion: { ...training.natacion },
      casa: { ...training.casa },
    },
    english: (() => {
      const english = log.english ?? emptyTrainingSession();
      return {
        ...english,
        minutes: english.done ? ENGLISH_FIXED_MINUTES : english.minutes,
      };
    })(),
    activeWorkTimer: log.activeWorkTimer
      ? {
          ...log.activeWorkTimer,
          items: [...(log.activeWorkTimer.items ?? [])],
        }
      : null,
    creatine: Boolean(log.creatine),
    food: {
      desayuno: { ...food.desayuno },
      almuerzo: { ...food.almuerzo },
      merienda: { ...food.merienda },
      cena: { ...food.cena },
    },
  };
}

function workTextsFromLog(log: ErpDayLog): Record<WorkCategoryKey, string> {
  return {
    software: formatHoursAsHm(log.work.software),
    saas: formatHoursAsHm(log.work.saas),
    planificacion: formatHoursAsHm(log.work.planificacion),
    branding: formatHoursAsHm(log.work.branding),
    itNews: formatHoursAsHm(log.work.itNews ?? 0),
    stremear: formatHoursAsHm(log.work.stremear ?? 0),
  };
}

function trainingTextsFromLog(
  log: ErpDayLog,
): Record<TrainingCategoryKey, string> {
  const training = normalizeTraining(log.training);
  return {
    gimnasio: formatMinutesAsHm(training.gimnasio.minutes),
    natacion: formatMinutesAsHm(training.natacion.minutes),
    casa: formatMinutesAsHm(training.casa.minutes),
  };
}

export default function ErpDayForm({
  selectedDate,
  onSelectedDateChange,
  dayLogs,
  onSave,
  onDelete,
  onClose,
  loading,
  saving,
  saveError,
}: Props) {
  const monday = mondayOfWeek(selectedDate);
  const week = weekDates(monday);
  const existing = useMemo(
    () => dayLogs.find((l) => l.date === selectedDate),
    [dayLogs, selectedDate],
  );

  const [draft, setDraft] = useState<ErpDayLog>(() =>
    existing ? cloneLog(existing) : emptyDayLog(selectedDate),
  );
  const [workText, setWorkText] = useState<Record<WorkCategoryKey, string>>(() =>
    workTextsFromLog(existing ? cloneLog(existing) : emptyDayLog(selectedDate)),
  );
  const [trainingText, setTrainingText] = useState<
    Record<TrainingCategoryKey, string>
  >(() =>
    trainingTextsFromLog(existing ? cloneLog(existing) : emptyDayLog(selectedDate)),
  );
  const [pasteText, setPasteText] = useState("");
  const [pasteResult, setPasteResult] = useState<ParseWorkTimersPasteResult | null>(
    null,
  );

  useEffect(() => {
    const next = existing ? cloneLog(existing) : emptyDayLog(selectedDate);
    setDraft(next);
    setWorkText(workTextsFromLog(next));
    setTrainingText(trainingTextsFromLog(next));
    setPasteText("");
    setPasteResult(null);
  }, [selectedDate, existing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (saving) return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const workTotal = sumWorkHours(draft.work);
  const delay = minutesBetweenTimes(draft.alarm.rangAt, draft.alarm.startedWorkAt);

  const commitWorkField = (key: WorkCategoryKey, raw: string) => {
    const parsed = parseDurationToHours(raw);
    if (parsed === null) {
      setWorkText((prev) => ({ ...prev, [key]: formatHoursAsHm(draft.work[key]) }));
      return;
    }
    setDraft((prev) => ({ ...prev, work: { ...prev.work, [key]: parsed } }));
    setWorkText((prev) => ({ ...prev, [key]: formatHoursAsHm(parsed) }));
  };

  const handleParsePaste = () => {
    const result = parseWorkTimersPaste(pasteText);
    setPasteResult(result);
  };

  const handleApplyPaste = () => {
    if (!pasteResult?.ok) return;
    setDraft((prev) => {
      const timers = normalizeWorkTimers(prev.workTimers ?? emptyWorkTimers());
      const merged = mergeWorkTimersPaste(prev.work, timers, pasteResult);
      setWorkText(workTextsFromLog({ ...prev, work: merged.work }));
      return { ...prev, work: merged.work, workTimers: merged.workTimers };
    });
  };

  const handleClearPaste = () => {
    setPasteText("");
    setPasteResult(null);
  };

  const patchTraining = (
    key: TrainingCategoryKey,
    patch: Partial<ErpTrainingSession>,
  ) => {
    setDraft((prev) => ({
      ...prev,
      training: {
        ...prev.training,
        [key]: { ...prev.training[key], ...patch },
      },
    }));
  };

  const commitTrainingDuration = (key: TrainingCategoryKey, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      patchTraining(key, { minutes: null });
      setTrainingText((prev) => ({ ...prev, [key]: "" }));
      return;
    }
    const mins = parseDurationToMinutes(trimmed);
    if (mins === null) {
      setTrainingText((prev) => ({
        ...prev,
        [key]: formatMinutesAsHm(draft.training[key].minutes),
      }));
      return;
    }
    patchTraining(key, { minutes: mins });
    setTrainingText((prev) => ({ ...prev, [key]: formatMinutesAsHm(mins) }));
  };

  const toggleTraining = (key: TrainingCategoryKey) => {
    setDraft((prev) => {
      const cur = prev.training[key];
      const nextDone = !cur.done;
      if (!nextDone) {
        setTrainingText((text) => ({ ...text, [key]: "" }));
      } else if (key === "natacion") {
        setTrainingText((text) => ({
          ...text,
          natacion: formatMinutesAsHm(NATACION_FIXED_MINUTES),
        }));
      }
      return {
        ...prev,
        training: {
          ...prev.training,
          [key]: nextDone
            ? {
                ...cur,
                done: true,
                ...(key === "natacion" ? { minutes: NATACION_FIXED_MINUTES } : {}),
              }
            : emptyTrainingSession(false),
        },
      };
    });
  };

  const toggleEnglish = () => {
    setDraft((prev) => ({
      ...prev,
      english: prev.english.done
        ? emptyTrainingSession(false)
        : { ...prev.english, done: true, minutes: ENGLISH_FIXED_MINUTES },
    }));
  };

  const patchEnglish = (patch: Partial<ErpTrainingSession>) => {
    setDraft((prev) => ({
      ...prev,
      english: { ...prev.english, ...patch },
    }));
  };

  const toggleMeal = (key: MealKey) => {
    setDraft((prev) => {
      const food = normalizeFood(prev.food);
      const cur = food[key];
      const nextDone = !cur.done;
      return {
        ...prev,
        food: {
          ...food,
          [key]: nextDone ? { done: true, quality: cur.quality } : emptyMeal(false),
        },
      };
    });
  };

  const setMealQuality = (key: MealKey, quality: number | null) => {
    setDraft((prev) => {
      const food = normalizeFood(prev.food);
      return {
        ...prev,
        food: {
          ...food,
          [key]: { ...food[key], done: true, quality },
        },
      };
    });
  };

  const toggleCreatine = () => {
    setDraft((prev) => ({ ...prev, creatine: !prev.creatine }));
  };

  const handleSave = async () => {
    // Commit any pending text fields before save
    const nextWork = { ...draft.work };
    (Object.keys(workText) as WorkCategoryKey[]).forEach((key) => {
      const parsed = parseDurationToHours(workText[key]);
      if (parsed !== null) nextWork[key] = parsed;
    });
    const nextTraining = normalizeTraining(draft.training);
    (Object.keys(trainingText) as TrainingCategoryKey[]).forEach((key) => {
      if (!nextTraining[key].done) return;
      if (key === "natacion") {
        nextTraining[key] = {
          ...nextTraining[key],
          minutes: NATACION_FIXED_MINUTES,
        };
        return;
      }
      const trimmed = trainingText[key].trim();
      if (trimmed === "") {
        nextTraining[key] = { ...nextTraining[key], minutes: null };
        return;
      }
      const mins = parseDurationToMinutes(trimmed);
      if (mins !== null) {
        nextTraining[key] = { ...nextTraining[key], minutes: mins };
      }
    });
    const liveActive =
      dayLogs.find((l) => l.date === selectedDate)?.activeWorkTimer ??
      draft.activeWorkTimer ??
      null;
    const log: ErpDayLog = {
      ...draft,
      date: selectedDate,
      work: nextWork,
      training: nextTraining,
      english: {
        ...draft.english,
        minutes: draft.english.done ? ENGLISH_FIXED_MINUTES : null,
      },
      activeWorkTimer: liveActive,
    };
    try {
      const savedLog = await onSave(log);
      setDraft(savedLog);
      setWorkText(workTextsFromLog(savedLog));
      setTrainingText(trainingTextsFromLog(savedLog));
    } catch {
      // El error lo muestra el contenedor.
    }
  };

  const handleDelete = async () => {
    if (!existing || !window.confirm(`¿Eliminar el registro del ${formatLocalDate(selectedDate)}?`)) {
      return;
    }
    try {
      await onDelete(selectedDate);
      const empty = emptyDayLog(selectedDate);
      setDraft(empty);
      setWorkText(workTextsFromLog(empty));
      setTrainingText(trainingTextsFromLog(empty));
    } catch {
      // El mensaje de error lo muestra el contenedor.
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Cargar día</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatLocalDate(selectedDate)} · guardado en MongoDB
          </p>
        </div>
        <label className="text-xs font-medium text-slate-600">
          Fecha
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onSelectedDateChange(e.target.value)}
            className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        {week.map((date) => {
          const active = date === selectedDate;
          const hasData = dayLogs.some((l) => l.date === date);
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelectedDateChange(date)}
              className={`min-w-[64px] rounded-xl border px-3 py-2 text-center transition cursor-pointer ${
                active
                  ? "border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-200"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <span className="block text-[10px] font-semibold uppercase tracking-wide">
                {dayShortLabel(date)}
              </span>
              <span className="block text-sm font-bold">{Number(date.slice(8))}</span>
              {hasData ? (
                <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              ) : (
                <span className="mt-0.5 inline-block h-1.5 w-1.5 rounded-full bg-slate-200" />
              )}
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Moon className="h-5 w-5 text-amber-700" />
          <h3 className="text-sm font-bold text-slate-950">Sueño</h3>
          <span className="ml-1 text-[11px] font-normal text-slate-400">· opcional</span>
          {delay !== null && (
            <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800">
              Retraso {delay} min
            </span>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">
            Sonó
            <input
              type="time"
              value={draft.alarm.rangAt ?? ""}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  alarm: { ...p.alarm, rangAt: e.target.value || null },
                }))
              }
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Veces pospuesta
            <input
              type="number"
              min={0}
              step={1}
              value={draft.alarm.snoozedTimes ?? ""}
              placeholder="Sin dato"
              onChange={(e) => {
                const raw = e.target.value.trim();
                setDraft((p) => ({
                  ...p,
                  alarm: {
                    ...p.alarm,
                    snoozedTimes:
                      raw === "" ? null : Math.max(0, parseInt(raw, 10) || 0),
                  },
                }));
              }}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-300"
            />
          </label>
          <label className="text-xs font-medium text-slate-600">
            Empecé a trabajar
            <input
              type="time"
              value={draft.alarm.startedWorkAt ?? ""}
              onChange={(e) =>
                setDraft((p) => ({
                  ...p,
                  alarm: { ...p.alarm, startedWorkAt: e.target.value || null },
                }))
              }
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-4 border-t border-amber-100 pt-3">
          <label className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
            <span className="shrink-0">
              Horas dormidas
              <span className="ml-1 font-normal text-slate-400">· opcional</span>
            </span>
            <input
              type="number"
              min={0}
              max={24}
              step={0.1}
              value={draft.sleepHours ?? ""}
              placeholder="Sin dato"
              onChange={(e) => {
                const raw = e.target.value.trim();
                setDraft((p) => ({
                  ...p,
                  sleepHours: raw === "" ? null : Math.max(0, parseFloat(raw) || 0),
                }));
              }}
              className="w-28 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm placeholder:text-slate-300"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-950">Trabajo</h3>
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
            Total {formatHoursAsHm(workTotal)} hs
          </span>
        </div>
        <p className="mb-4 text-xs text-slate-400">
          Escribí como <strong className="font-semibold text-slate-600">4:52</strong> (horas:minutos).
          También acepta decimal (4.5). O pegá el desglose de timers abajo.
        </p>
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
          <label className="block text-xs font-medium text-slate-600">
            Pegar desglose de timers
            <textarea
              value={pasteText}
              onChange={(e) => {
                setPasteText(e.target.value);
                setPasteResult(null);
              }}
              rows={6}
              placeholder={`**SaaS — 0:56 hs**\n\n- saas - La evolución del Frontend → 0:22:23\n- saas - genteleman escalando → 0:33:49\n\n**Software development — 0:42 hs**\n\n- erpp mejora → 0:20:29`}
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-slate-800"
            />
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleParsePaste}
              disabled={!pasteText.trim()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Parsear
            </button>
            <button
              type="button"
              onClick={handleApplyPaste}
              disabled={!pasteResult?.ok}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              Aplicar al día
            </button>
            <button
              type="button"
              onClick={handleClearPaste}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition cursor-pointer"
            >
              Limpiar
            </button>
          </div>
          {pasteResult && (
            <div className="mt-3 space-y-1.5">
              {pasteResult.error ? (
                <p className="text-xs font-medium text-rose-600">{pasteResult.error}</p>
              ) : (
                <p className="text-xs font-medium text-emerald-700">
                  Listo: {pasteResult.summary.categories} categor
                  {pasteResult.summary.categories === 1 ? "ía" : "ías"} ·{" "}
                  {pasteResult.summary.timers} timer
                  {pasteResult.summary.timers === 1 ? "" : "s"}. Revisá y aplicá.
                </p>
              )}
              {pasteResult.warnings.map((w) => (
                <p key={w} className="text-[11px] text-amber-700">
                  {w}
                </p>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {WORK_CATEGORY_META.map((cat) => {
            const timers =
              (draft.workTimers ?? emptyWorkTimers())[cat.key] ?? [];
            return (
              <div key={cat.key} className="text-xs font-medium text-slate-600">
                <label className="block">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    {cat.name}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0:00"
                    value={workText[cat.key]}
                    onChange={(e) =>
                      setWorkText((prev) => ({ ...prev, [cat.key]: e.target.value }))
                    }
                    onBlur={(e) => commitWorkField(cat.key, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.currentTarget.blur();
                      }
                    }}
                    className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm"
                  />
                </label>
                {timers.length > 0 && (
                  <ul className="mt-2 space-y-1 rounded-lg border border-slate-100 bg-white px-2.5 py-2">
                    {timers.map((timer, idx) => (
                      <li
                        key={`${timer.name}-${idx}`}
                        className="flex items-center justify-between gap-2 text-[11px] font-normal text-slate-500"
                      >
                        <span className="min-w-0 truncate">{timer.name}</span>
                        <span className="shrink-0 font-mono text-slate-700">
                          {formatSecondsAsClock(timer.seconds)}
                        </span>
                      </li>
                    ))}
                    <li className="flex justify-between border-t border-slate-100 pt-1 text-[10px] text-slate-400">
                      <span>Suma timers</span>
                      <span className="font-mono">
                        {formatSecondsAsClock(sumWorkTimerSeconds(timers))}
                      </span>
                    </li>
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-bold text-slate-950">Entrenamiento</h3>
        <p className="mb-4 text-xs text-slate-400">
          Duración como en trabajo:{" "}
          <strong className="font-semibold text-slate-600">1:30</strong> (horas:minutos).
        </p>
        <div className="space-y-3">
          {trainingMeta.map(({ key, label, icon: Icon }) => {
            const session = draft.training[key];
            const on = session.done;
            return (
              <div
                key={key}
                className={`rounded-xl border p-3 transition ${
                  on
                    ? "border-violet-300 bg-violet-50/70"
                    : "border-slate-200 bg-slate-50/80"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleTraining(key)}
                  className={`flex w-full items-center gap-3 text-left cursor-pointer ${
                    on ? "text-violet-900" : "text-slate-500"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="text-sm font-semibold">{label}</span>
                  {on && <Check className="ml-auto h-4 w-4 text-violet-600" />}
                </button>

                {on && (
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[120px_1fr]">
                    <label className="text-[11px] font-medium text-slate-600">
                      Duración
                      {key === "natacion" ? (
                        <span className="font-normal text-slate-400"> · fija</span>
                      ) : (
                        <span className="font-normal text-slate-400"> · opcional</span>
                      )}
                      {key === "natacion" ? (
                        <p className="mt-1 flex h-[34px] items-center rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-sm text-slate-700">
                          1:00
                        </p>
                      ) : (
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="0:00"
                          value={trainingText[key]}
                          onChange={(e) =>
                            setTrainingText((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          onBlur={(e) => commitTrainingDuration(key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono text-sm"
                        />
                      )}
                    </label>
                    <label className="text-[11px] font-medium text-slate-600">
                      {key === "casa" ? "Detalle / series" : "Detalle"}
                      <input
                        type="text"
                        placeholder={
                          key === "casa"
                            ? "3 series bíceps, 2 abs"
                            : key === "natacion"
                              ? "Ej. técnica, series…"
                              : "Ej. piernas, espalda…"
                        }
                        value={session.notes ?? ""}
                        onChange={(e) => patchTraining(key, { notes: e.target.value })}
                        className="mt-1 block w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm"
                      />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-orange-50/40 p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-sm font-bold text-slate-900">Alimentación</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Marcá cada comida y, si querés, su calidad (1–5).
          </p>
        </div>
        <div className="space-y-2">
          {MEAL_META.map(({ key, label }) => {
            const meal = (draft.food ?? emptyFood())[key];
            return (
              <div
                key={key}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2 ring-1 ring-slate-200/80"
              >
                <button
                  type="button"
                  onClick={() => toggleMeal(key)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition cursor-pointer ${
                    meal.done
                      ? "bg-amber-100 text-amber-900 ring-1 ring-amber-200"
                      : "bg-slate-50 text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  {label}
                  {meal.done && <Check className="h-3.5 w-3.5 text-amber-700" />}
                </button>
                {meal.done ? (
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-medium text-slate-500">Calidad</span>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setMealQuality(key, meal.quality === n ? null : n)
                        }
                        className={`h-7 w-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                          meal.quality === n
                            ? "bg-amber-500 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-400">Sin marcar</span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/40 p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Inglés</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Seguimiento liviano, separado del entrenamiento.
            </p>
          </div>
          <button
            type="button"
            onClick={toggleEnglish}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              draft.english.done
                ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
                : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            <BookOpen className="h-4 w-4" />
            {draft.english.done ? "Hecho" : "Marcar"}
            {draft.english.done && <Check className="h-3.5 w-3.5 text-emerald-600" />}
          </button>
        </div>

        {draft.english.done ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[110px_1fr]">
            <label className="text-[11px] font-medium text-slate-600">
              Duración
              <span className="font-normal text-slate-400"> · fija</span>
              <p className="mt-1 flex h-[38px] items-center rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm text-slate-700">
                1:00
              </p>
            </label>
            <label className="text-[11px] font-medium text-slate-600">
              Detalle
              <input
                type="text"
                placeholder="Listening, vocabulario, clase…"
                aria-label="Detalle de inglés"
                value={draft.english.notes ?? ""}
                onChange={(event) => patchEnglish({ notes: event.target.value })}
                className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
              />
            </label>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-emerald-200 bg-white/70 px-3 py-2 text-xs text-slate-500">
            Si ese día hiciste inglés, marcá y opcionalmente agregá un detalle.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-cyan-200/80 bg-gradient-to-br from-cyan-50/70 via-white to-sky-50/40 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Creatina</h3>
            <p className="mt-0.5 text-xs text-slate-500">¿La tomaste hoy?</p>
          </div>
          <button
            type="button"
            onClick={toggleCreatine}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              draft.creatine
                ? "bg-cyan-100 text-cyan-800 ring-1 ring-cyan-200"
                : "bg-white text-slate-600 ring-1 ring-slate-200"
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            {draft.creatine ? "Tomada" : "Marcar"}
            {draft.creatine && <Check className="h-3.5 w-3.5 text-cyan-600" />}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
        <label className="text-xs font-medium text-slate-600">
          Notas (opcional)
          <textarea
            value={draft.notes ?? ""}
            onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))}
            rows={3}
            placeholder="Detalle libre del día…"
            className="mt-2 block w-full resize-y rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving || loading}
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {saving ? "Guardando…" : "Guardar día"}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={saving || loading}
          aria-label="Cerrar sin guardar"
          title="Cerrar sin guardar"
          className="inline-flex h-[42px] w-[42px] items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
        {existing && (
          <button
            type="button"
            onClick={() => void handleDelete()}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            Eliminar día
          </button>
        )}
        {saveError && (
          <span className="text-sm font-medium text-rose-700">{saveError}</span>
        )}
      </div>
    </div>
  );
}
