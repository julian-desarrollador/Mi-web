"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  formatHoursAsHm,
  normalizeWork,
  normalizeWorkTimers,
  parseDurationToHours,
  sumWorkHours,
  sumWorkTimerSeconds,
  UNNAMED_WORK_TIMER,
  WORK_CATEGORY_META,
  type ErpActiveWorkTimer,
  type ErpDayLog,
  type ErpWorkTimer,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import {
  formatSecondsAsClock,
  parseClockDurationToSeconds,
} from "@/app/admin92/erp/lib/parseWorkTimersPaste";
import { formatLocalDate } from "@/app/admin92/contabilidad/lib/utils";
import LiveTimerPlayButton from "@/app/admin92/erp/components/LiveTimerPlayButton";

type Props = {
  editLog: ErpDayLog;
  onPersist: (log: ErpDayLog) => Promise<void>;
  persisting?: boolean;
  /** Vista agregada (semana/mes): solo lectura */
  readOnly?: boolean;
  /** Texto bajo el título; por defecto la fecha del log. String vacío oculta el renglón. */
  subtitle?: string;
  /** Ocultar categorías sin horas ni timers (Historial). */
  hideEmptyCategories?: boolean;
  /** duration = Categorías; newest = Historial (array se guarda antiguo→nuevo). */
  timerOrder?: "duration" | "newest";
  icons: Record<WorkCategoryKey, ComponentType<{ className?: string }>>;
  activeWorkTimer?: ErpActiveWorkTimer | null;
  onStartLiveTimer?: (category: WorkCategoryKey, name: string) => Promise<void>;
  timerSaving?: boolean;
};

function syncWorkFromTimers(log: ErpDayLog): ErpDayLog {
  const workTimers = normalizeWorkTimers(log.workTimers);
  const work = normalizeWork(log.work);
  for (const key of Object.keys(work) as WorkCategoryKey[]) {
    const sum = sumWorkTimerSeconds(workTimers[key]);
    if (workTimers[key].length > 0) {
      work[key] = sum / 3600;
    }
  }
  return { ...log, work, workTimers };
}

function parseDurationToSeconds(raw: string, fallback: number): number {
  const trimmed = raw.trim();
  const parsedClock = parseClockDurationToSeconds(trimmed);
  if (parsedClock !== null) return parsedClock;
  const hours = parseDurationToHours(trimmed);
  if (hours !== null) return Math.round(hours * 3600);
  return fallback;
}

type EditingTarget =
  | { kind: "timer"; category: WorkCategoryKey; index: number }
  | { kind: "orphan"; category: WorkCategoryKey };

type DeleteConfirm =
  | { kind: "timer"; category: WorkCategoryKey; index: number; name: string }
  | { kind: "orphan"; category: WorkCategoryKey };

export default function WorkCategoriesEditor({
  editLog,
  onPersist,
  persisting = false,
  readOnly = false,
  subtitle,
  hideEmptyCategories = false,
  timerOrder = "duration",
  icons,
  activeWorkTimer = null,
  onStartLiveTimer,
  timerSaving = false,
}: Props) {
  const [expanded, setExpanded] = useState<Partial<Record<WorkCategoryKey, boolean>>>(
    {},
  );
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftTime, setDraftTime] = useState("");
  const [draftItems, setDraftItems] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const editingRef = useRef<HTMLLIElement | null>(null);

  const workTimers = useMemo(
    () => normalizeWorkTimers(editLog.workTimers),
    [editLog.workTimers],
  );
  const work = useMemo(() => normalizeWork(editLog.work), [editLog.work]);
  const workTotal = sumWorkHours(work);

  const categories = WORK_CATEGORY_META.map((c) => {
    const withIndex = (workTimers[c.key] ?? []).map((timer, index) => ({
      timer,
      index,
    }));
    const timers =
      timerOrder === "newest"
        ? [...withIndex].reverse()
        : [...withIndex].sort(
            (a, b) =>
              b.timer.seconds - a.timer.seconds ||
              a.timer.name.localeCompare(b.timer.name),
          );
    return {
      ...c,
      hours: work[c.key] ?? 0,
      timers,
    };
  }).filter((c) => !hideEmptyCategories || c.hours > 0 || c.timers.length > 0);

  const timerKey = (category: WorkCategoryKey, index: number) => `${category}:${index}`;
  const orphanKey = (category: WorkCategoryKey) => `${category}:orphan`;

  const parseEditingKey = (key: string | null): EditingTarget | null => {
    if (!key) return null;
    const [category, indexRaw] = key.split(":");
    if (
      category !== "software" &&
      category !== "saas" &&
      category !== "planificacion" &&
      category !== "branding" &&
      category !== "itNews" &&
      category !== "stremear"
    ) {
      return null;
    }
    if (indexRaw === "orphan") return { kind: "orphan", category };
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0) return null;
    return { kind: "timer", category, index };
  };

  useEffect(() => {
    setEditingKey(null);
    setDeleteConfirm(null);
  }, [editLog.date, readOnly]);

  useEffect(() => {
    const parsed = parseEditingKey(editingKey);
    if (!parsed) return;
    if (parsed.kind === "orphan") {
      const seconds = Math.round((work[parsed.category] ?? 0) * 3600);
      setDraftName(UNNAMED_WORK_TIMER);
      setDraftTime(formatSecondsAsClock(seconds));
      setDraftItems({});
      return;
    }
    const timer = workTimers[parsed.category]?.[parsed.index];
    if (!timer) {
      setEditingKey(null);
      return;
    }
    setDraftName(timer.name);
    setDraftTime(formatSecondsAsClock(timer.seconds));
    const items: Record<string, string> = {};
    for (const item of timer.items ?? []) items[item.id] = item.text;
    setDraftItems(items);
  }, [editingKey, workTimers, work]);

  useEffect(() => {
    if (!deleteConfirm) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDeleteConfirm(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [deleteConfirm]);

  useEffect(() => {
    if (!editingKey || deleteConfirm) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || editingRef.current?.contains(target)) return;
      void exitEdit(true);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cerrar al click afuera del timer en edición
  }, [editingKey, deleteConfirm, draftName, draftTime, draftItems, workTimers, work, editLog]);

  const persist = async (next: ErpDayLog) => {
    setError(null);
    try {
      await onPersist(syncWorkFromTimers(next));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const updateTimers = async (
    category: WorkCategoryKey,
    updater: (list: ErpWorkTimer[]) => ErpWorkTimer[],
  ) => {
    const list = updater([...(workTimers[category] ?? [])]);
    const nextWork = { ...work };
    if (list.length === 0) nextWork[category] = 0;
    await persist({
      ...editLog,
      work: nextWork,
      workTimers: { ...workTimers, [category]: list },
    });
  };

  const commitCurrentEdits = async () => {
    const parsed = parseEditingKey(editingKey);
    if (!parsed) return;

    let nextName = draftName.trim().slice(0, 200);
    if (!nextName) nextName = UNNAMED_WORK_TIMER;
    const nextSeconds = parseDurationToSeconds(
      draftTime,
      parsed.kind === "orphan"
        ? Math.round((work[parsed.category] ?? 0) * 3600)
        : (workTimers[parsed.category]?.[parsed.index]?.seconds ?? 0),
    );

    if (parsed.kind === "orphan") {
      const prevSeconds = Math.round((work[parsed.category] ?? 0) * 3600);
      if (nextName === UNNAMED_WORK_TIMER && nextSeconds === prevSeconds) return;
      await persist({
        ...editLog,
        work: { ...work, [parsed.category]: nextSeconds / 3600 },
        workTimers: {
          ...workTimers,
          [parsed.category]: [
            {
              name: nextName,
              seconds: nextSeconds,
              items: [],
            },
          ],
        },
      });
      return;
    }

    const { category, index } = parsed;
    const current = workTimers[category]?.[index];
    if (!current) return;

    const nextItems = (current.items ?? []).map((item) => {
      const text = (draftItems[item.id] ?? item.text).trim().slice(0, 300);
      return { ...item, text: text || item.text };
    });

    const nameChanged = nextName !== current.name;
    const timeChanged = nextSeconds !== current.seconds;
    const itemsChanged = (current.items ?? []).some((item) => {
      const draft = (draftItems[item.id] ?? item.text).trim();
      return draft !== item.text;
    });

    if (!nameChanged && !timeChanged && !itemsChanged) return;

    await updateTimers(category, (list) =>
      list.map((t, i) =>
        i === index
          ? {
              ...t,
              name: nextName,
              seconds: nextSeconds,
              items: nextItems.length > 0 ? nextItems : t.items,
            }
          : t,
      ),
    );
  };

  const exitEdit = async (shouldCommit: boolean) => {
    if (shouldCommit) await commitCurrentEdits();
    setEditingKey(null);
  };

  const startEdit = (key: string) => {
    if (readOnly) return;
    if (editingKey && editingKey !== key) {
      void commitCurrentEdits().then(() => setEditingKey(key));
      return;
    }
    setEditingKey(key);
  };

  const deleteTimer = (category: WorkCategoryKey, index: number) => {
    const current = workTimers[category][index];
    if (!current) return;
    setDeleteConfirm({
      kind: "timer",
      category,
      index,
      name: current.name,
    });
  };

  const deleteOrphan = (category: WorkCategoryKey) => {
    setDeleteConfirm({ kind: "orphan", category });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const pending = deleteConfirm;
    setDeleteConfirm(null);
    setEditingKey(null);
    if (pending.kind === "timer") {
      await updateTimers(pending.category, (list) =>
        list.filter((_, i) => i !== pending.index),
      );
      return;
    }
    await persist({
      ...editLog,
      work: { ...work, [pending.category]: 0 },
      workTimers: { ...workTimers, [pending.category]: [] },
    });
  };

  const deleteItem = async (
    category: WorkCategoryKey,
    timerIndex: number,
    itemId: string,
  ) => {
    setDraftItems((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    await updateTimers(category, (list) =>
      list.map((t, i) => {
        if (i !== timerIndex) return t;
        return {
          ...t,
          items: (t.items ?? []).filter((it) => it.id !== itemId),
        };
      }),
    );
  };

  const renderEditorRow = (
    key: string,
    onDelete: () => void,
    deleteLabel: string,
    items: ErpWorkTimer["items"] = [],
  ) => (
    <li
      key={key}
      ref={editingRef}
      className="space-y-1 rounded-lg border border-blue-200 bg-blue-50/40 p-2"
    >
      <div className="flex items-center gap-2">
        <input
          type="text"
          autoFocus
          value={draftName}
          disabled={persisting}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void exitEdit(true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              void exitEdit(false);
            }
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-950"
          aria-label="Nombre del timer"
        />
        <input
          type="text"
          value={draftTime}
          disabled={persisting}
          onChange={(e) => setDraftTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void exitEdit(true);
            }
            if (e.key === "Escape") {
              e.preventDefault();
              void exitEdit(false);
            }
          }}
          className="w-[5.5rem] shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs font-semibold text-slate-950"
          aria-label="Duración del timer"
          title="H:MM o H:MM:SS"
        />
        <button
          type="button"
          onClick={onDelete}
          disabled={persisting}
          aria-label={deleteLabel}
          className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {(items ?? []).length > 0 && (
        <ul className="space-y-1 pl-1">
          {(items ?? []).map((item) => (
            <li key={item.id} className="flex items-center gap-1.5">
              <span className="text-slate-400">·</span>
              <input
                type="text"
                value={draftItems[item.id] ?? item.text}
                disabled={persisting}
                onChange={(e) =>
                  setDraftItems((prev) => ({
                    ...prev,
                    [item.id]: e.target.value,
                  }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void exitEdit(true);
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    void exitEdit(false);
                  }
                }}
                className={`min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium ${
                  item.done ? "text-slate-400 line-through" : "text-slate-800"
                }`}
                aria-label="Ítem del timer"
              />
              <button
                type="button"
                onClick={() => {
                  const parsed = parseEditingKey(key);
                  if (parsed?.kind === "timer") {
                    void deleteItem(parsed.category, parsed.index, item.id);
                  }
                }}
                disabled={persisting}
                aria-label="Eliminar ítem"
                className="rounded p-0.5 text-slate-300 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

  return (
    <div className="space-y-3">
      {subtitle !== "" ? (
        <p className="text-xs font-medium text-slate-500">
          {subtitle ??
            `${formatLocalDate(editLog.date)} · click en un timer para editar`}
          {!readOnly && persisting ? " · Guardando…" : ""}
        </p>
      ) : null}

      {categories.map((cat) => {
        const Icon = icons[cat.key];
        const pct = workTotal > 0 ? Math.round((cat.hours / workTotal) * 100) : 0;
        const open = Boolean(expanded[cat.key]);
        return (
          <div key={cat.key}>
            <div className="flex items-start gap-1.5">
              {onStartLiveTimer && (
                <div className="pt-0.5">
                  <LiveTimerPlayButton
                    category={cat.key}
                    name=""
                    activeWorkTimer={activeWorkTimer}
                    onToggle={onStartLiveTimer}
                    disabled={timerSaving}
                    label={`Iniciar ${cat.name}`}
                  />
                </div>
              )}
              <button
                type="button"
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [cat.key]: !prev[cat.key] }))
                }
                aria-expanded={open}
                className="group min-w-0 flex-1 cursor-pointer rounded-lg text-left transition hover:bg-slate-50/80"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2 px-1 py-0.5">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                    {open ? (
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                    <Icon className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-slate-950">
                    {formatHoursAsHm(cat.hours)} hs
                    <span
                      className="ml-2 text-sm font-bold tabular-nums"
                      style={{ color: "#1571d4" }}
                    >
                      {pct}%
                    </span>
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: cat.color }}
                  />
                </div>
              </button>
            </div>

            <div
              className="grid transition-[grid-template-rows,opacity] duration-300 ease-out"
              style={{
                gridTemplateRows: open ? "1fr" : "0fr",
                opacity: open ? 1 : 0,
              }}
            >
              <div className="overflow-hidden">
                <ul className="mt-2 space-y-1.5 border-l-2 border-slate-100 pl-3 ml-2">
                  {cat.timers.length === 0 ? (
                    (() => {
                      const orphanSeconds = Math.round(cat.hours * 3600);
                      if (orphanSeconds <= 0) {
                        return (
                          <li className="text-xs font-medium text-slate-500">
                            Sin desglose de timers
                          </li>
                        );
                      }
                      const key = orphanKey(cat.key);
                      if (editingKey === key) {
                        return renderEditorRow(
                          key,
                          () => void deleteOrphan(cat.key),
                          "Eliminar horas sin desglose",
                        );
                      }
                      return (
                        <li key={key}>
                          <div className="flex items-start gap-1.5">
                            {onStartLiveTimer && (
                              <LiveTimerPlayButton
                                category={cat.key}
                                name=""
                                activeWorkTimer={activeWorkTimer}
                                onToggle={onStartLiveTimer}
                                disabled={timerSaving}
                                label={`Iniciar ${cat.name} sin nombre`}
                              />
                            )}
                            {readOnly ? (
                              <div className="min-w-0 flex-1 rounded-lg px-1.5 py-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate text-xs font-semibold text-amber-800">
                                    Horas sin desglose
                                  </span>
                                  <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                                    {formatSecondsAsClock(orphanSeconds)}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => startEdit(key)}
                                className="min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="min-w-0 truncate text-xs font-semibold text-amber-800">
                                    Horas sin desglose
                                  </span>
                                  <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                                    {formatSecondsAsClock(orphanSeconds)}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                                  Click para nombrar o editar este tiempo
                                </p>
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })()
                  ) : (
                    cat.timers.map(({ timer, index }) => {
                      const key = timerKey(cat.key, index);
                      const isEditing = editingKey === key;

                      if (!isEditing) {
                        const timerBody = (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-xs font-semibold text-slate-800">
                                {timer.name}
                              </span>
                              <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                                {formatSecondsAsClock(timer.seconds)}
                              </span>
                            </div>
                            {(timer.items ?? []).length > 0 && (
                              <ul className="mt-1 space-y-0.5 pl-2">
                                {(timer.items ?? []).map((item) => (
                                  <li
                                    key={item.id}
                                    className={`truncate text-[11px] ${
                                      item.done
                                        ? "text-slate-400 line-through"
                                        : "text-slate-600"
                                    }`}
                                  >
                                    · {item.text}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        );
                        return (
                          <li key={`${cat.key}-${index}-${timer.name}`}>
                            <div className="flex items-start gap-1.5">
                              {onStartLiveTimer && (
                                <LiveTimerPlayButton
                                  category={cat.key}
                                  name={timer.name}
                                  activeWorkTimer={activeWorkTimer}
                                  onToggle={onStartLiveTimer}
                                  disabled={timerSaving}
                                />
                              )}
                              {readOnly ? (
                                <div className="min-w-0 flex-1 rounded-lg px-1.5 py-1">
                                  {timerBody}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(key)}
                                  className="min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50"
                                >
                                  {timerBody}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      }

                      return renderEditorRow(
                        key,
                        () => void deleteTimer(cat.key, index),
                        `Eliminar ${timer.name}`,
                        timer.items,
                      );
                    })
                  )}
                </ul>
              </div>
            </div>
          </div>
        );
      })}

      {error && <p className="text-sm font-medium text-rose-700">{error}</p>}

      {deleteConfirm && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDeleteConfirm(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="erp-delete-timer-title"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-50 p-2.5 text-rose-600 ring-1 ring-rose-100">
                <AlertTriangle className="h-5 w-5" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="erp-delete-timer-title"
                  className="text-base font-bold text-slate-950"
                >
                  {deleteConfirm.kind === "timer"
                    ? "Eliminar timer"
                    : "Eliminar horas sin desglose"}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {deleteConfirm.kind === "timer" ? (
                    <>
                      ¿Eliminar el timer{" "}
                      <span className="font-semibold text-slate-900">
                        “{deleteConfirm.name}”
                      </span>
                      ? Esta acción no se puede deshacer.
                    </>
                  ) : (
                    <>
                      ¿Eliminar estas horas sin desglose? Esta acción no se puede
                      deshacer.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={persisting}
                className="cursor-pointer rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
