"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Check,
  ChevronDown,
  Clock3,
  Headphones,
  LoaderCircle,
  Play,
  Plus,
  Square,
  Star,
  Trash2,
} from "lucide-react";
import CuotasTimerStrip from "@/app/admin92/erp/components/CuotasTimerStrip";
import {
  activeCuotaClients,
  elapsedSessionSeconds,
  newWorkTimerItemId,
  normalizeActiveWorkTimer,
  normalizeWorkTimers,
  readTimerDestino,
  setActiveCuotasOnLog,
  startActiveWorkTimerOnLog,
  stopActiveWorkTimerOnLog,
  UNNAMED_WORK_TIMER,
  WORK_CATEGORY_META,
  type ErpActiveWorkTimer,
  type ErpDayLog,
  type ErpTimeKind,
  type ErpTimerDestino,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import { formatSecondsAsClock } from "@/app/admin92/erp/lib/parseWorkTimersPaste";
import MoodPromptModal from "@/app/admin92/erp/components/MoodPromptModal";
import { formatDuration, minutesBetween, type MoodScore } from "@/app/admin92/erp/lib/erpHabitos";
import { clockNow, useErpMoods } from "@/app/admin92/erp/lib/useErpMoods";

/**
 * start: al arrancar la sesión (o "+ mood").
 * close: al detener la sesión (stop) o al cambiar de mood en medio de la racha (switch).
 */
type MoodPrompt =
  | { kind: "start" }
  | { kind: "close"; reason: "stop" | "switch"; sessionStart: string | null };

type RecentTimer = {
  name: string;
  category: WorkCategoryKey;
};

/** Opciones del menú Categoría con atajos 1…N (incluye Sin filtrar). */
const CATEGORY_MENU_OPTIONS: {
  key: WorkCategoryKey | null;
  name: string;
  color: string | null;
}[] = [
  { key: null, name: "Sin filtrar", color: null },
  ...WORK_CATEGORY_META.map((c) => ({
    key: c.key as WorkCategoryKey | null,
    name: c.name,
    color: c.color as string | null,
  })),
];

type Props = {
  todayLog: ErpDayLog;
  dayLogs: ErpDayLog[];
  onPersist: (log: ErpDayLog) => Promise<void>;
  persisting: boolean;
  /** Período elegido abajo (Día / Semana / Mes): totales de los chips de cuotas */
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
};

function categoriesToScan(category: WorkCategoryKey | null): WorkCategoryKey[] {
  if (category) return [category];
  return WORK_CATEGORY_META.map((c) => c.key);
}

function buildRecentTimers(
  logs: ErpDayLog[],
  category: WorkCategoryKey | null,
  limit = 14,
): RecentTimer[] {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const seen = new Set<string>();
  const out: RecentTimer[] = [];
  const cats = categoriesToScan(category);

  for (const log of sorted) {
    const timers = normalizeWorkTimers(log.workTimers);
    for (const cat of cats) {
      for (const timer of [...timers[cat]].reverse()) {
        const name = timer.name.trim();
        if (!name || name === UNNAMED_WORK_TIMER) continue;
        const key = `${cat}::${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ name, category: cat });
        if (out.length >= limit) return out;
      }
    }
    const active = normalizeActiveWorkTimer(log.activeWorkTimer ?? null);
    if (
      active &&
      cats.includes(active.category) &&
      active.name.trim() &&
      active.name !== UNNAMED_WORK_TIMER
    ) {
      const key = `${active.category}::${active.name.trim().toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ name: active.name.trim(), category: active.category });
        if (out.length >= limit) return out;
      }
    }
  }
  return out;
}

/** Nombres más usados (frecuencia, desempate por más reciente). Null = todas las categorías. */
function buildFavoriteTimers(
  logs: ErpDayLog[],
  category: WorkCategoryKey | null,
  limit = 8,
): RecentTimer[] {
  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  const counts = new Map<
    string,
    { name: string; category: WorkCategoryKey; count: number; lastIndex: number }
  >();
  const cats = categoriesToScan(category);

  sorted.forEach((log, dateIndex) => {
    const bump = (raw: string, cat: WorkCategoryKey) => {
      const name = raw.trim();
      if (!name || name === UNNAMED_WORK_TIMER) return;
      const key = `${cat}::${name.toLowerCase()}`;
      const prev = counts.get(key);
      if (prev) {
        prev.count += 1;
        prev.lastIndex = Math.min(prev.lastIndex, dateIndex);
      } else {
        counts.set(key, { name, category: cat, count: 1, lastIndex: dateIndex });
      }
    };

    const timers = normalizeWorkTimers(log.workTimers);
    for (const cat of cats) {
      for (const timer of timers[cat]) bump(timer.name, cat);
    }

    const active = normalizeActiveWorkTimer(log.activeWorkTimer ?? null);
    if (active && cats.includes(active.category)) {
      bump(active.name, active.category);
    }
  });

  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.lastIndex - b.lastIndex)
    .slice(0, limit)
    .map(({ name, category: cat }) => ({ name, category: cat }));
}

export default function ErpLiveTimer({
  todayLog,
  dayLogs,
  onPersist,
  persisting,
  periodFrom,
  periodTo,
  periodLabel,
}: Props) {
  const active = useMemo(
    () => normalizeActiveWorkTimer(todayLog.activeWorkTimer ?? null),
    [todayLog.activeWorkTimer],
  );

  const [category, setCategory] = useState<WorkCategoryKey | null>("software");
  const [name, setName] = useState("");
  const [destino, setDestino] = useState<"" | "cuota" | ErpTimeKind>("");
  const openCuotas = useMemo(() => activeCuotaClients(active), [active]);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [itemDraft, setItemDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const pickerRootRef = useRef<HTMLDivElement>(null);
  const categoryRootRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<number | null>(null);

  const categoryMeta = useMemo(
    () =>
      category ? WORK_CATEGORY_META.find((c) => c.key === category) : undefined,
    [category],
  );
  const showAllNames = category === null;

  const favoriteTimers = useMemo(
    () => buildFavoriteTimers(dayLogs, category),
    [dayLogs, category],
  );

  const recentTimers = useMemo(
    () => buildRecentTimers(dayLogs, category),
    [dayLogs, category],
  );

  const query = name.trim().toLowerCase();
  const filteredFavorites = useMemo(() => {
    if (!query) return favoriteTimers;
    return favoriteTimers.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        (showAllNames &&
          WORK_CATEGORY_META.find((c) => c.key === t.category)
            ?.name.toLowerCase()
            .includes(query)),
    );
  }, [query, favoriteTimers, showAllNames]);

  const favoriteKeys = useMemo(
    () =>
      new Set(
        filteredFavorites.map((t) => `${t.category}::${t.name.toLowerCase()}`),
      ),
    [filteredFavorites],
  );

  const filteredRecent = useMemo(() => {
    const base = query
      ? recentTimers.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            (showAllNames &&
              WORK_CATEGORY_META.find((c) => c.key === t.category)
                ?.name.toLowerCase()
                .includes(query)),
        )
      : recentTimers;
    return base.filter(
      (t) => !favoriteKeys.has(`${t.category}::${t.name.toLowerCase()}`),
    );
  }, [query, recentTimers, favoriteKeys, showAllNames]);

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active?.startedAt, active?.category, active?.name]);

  useEffect(() => {
    if (!active) return;
    setCategory(active.category);
  }, [active?.startedAt, active?.category]);

  useEffect(() => {
    if (!active) return;
    setName(active.name);
  }, [active?.startedAt, active?.name]);

  useEffect(() => {
    if (!active) return;
    if (activeCuotaClients(active).length > 0) {
      setDestino("cuota");
      return;
    }
    setDestino(active.timeKind ?? "");
  }, [active?.startedAt, active?.cuotaClient, active?.cuotaClients, active?.share, active?.timeKind]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || pickerRootRef.current?.contains(target)) return;
      setPickerOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [pickerOpen]);

  useEffect(() => {
    if (!categoryOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target || categoryRootRef.current?.contains(target)) return;
      setCategoryOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [categoryOpen]);

  useEffect(() => {
    return () => {
      if (blurTimer.current) window.clearTimeout(blurTimer.current);
    };
  }, []);

  const elapsed = active ? elapsedSessionSeconds(active, nowMs) : 0;

  const moodsApi = useErpMoods();
  const { openMood } = moodsApi;
  const [moodPrompt, setMoodPrompt] = useState<MoodPrompt | null>(null);
  /** Remonta el modal en cada apertura para que arranque limpio. */
  const [moodPromptKey, setMoodPromptKey] = useState(0);
  const [moodBusy, setMoodBusy] = useState(false);
  const [moodError, setMoodError] = useState<string | null>(null);

  useEffect(() => {
    if (!moodsApi.loaded) void moodsApi.reload().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga inicial
  }, []);

  const openMoodPrompt = (prompt: MoodPrompt) => {
    setMoodError(null);
    setMoodPromptKey((key) => key + 1);
    setMoodPrompt(prompt);
  };

  const runMood = async (action: () => Promise<unknown>, after: MoodPrompt | null = null) => {
    setMoodBusy(true);
    setMoodError(null);
    try {
      await action();
      if (after) openMoodPrompt(after);
      else setMoodPrompt(null);
    } catch (err) {
      setMoodError(err instanceof Error ? err.message : "No se pudo guardar el mood");
    } finally {
      setMoodBusy(false);
    }
  };

  const pickMood = (name: string) => {
    const same = openMood && openMood.mood.trim().toLowerCase() === name.trim().toLowerCase();
    if (same) {
      setMoodPrompt(null);
      return;
    }
    // Mood colgado de antes: se cierra sin puntaje y arranca el nuevo a la misma hora.
    void runMood(() => (openMood ? moodsApi.switchTo(openMood, {}, name) : moodsApi.start(name)));
  };

  const saveClosingMood = (
    prompt: Extract<MoodPrompt, { kind: "close" }>,
    value: { mood: string; score: MoodScore | null; note: string },
  ) => {
    const next: MoodPrompt | null = prompt.reason === "switch" ? { kind: "start" } : null;
    void runMood(
      () =>
        openMood
          ? moodsApi.close(openMood, value)
          : moodsApi.createClosed({ ...value, startedAt: prompt.sessionStart ?? clockNow() }),
      next,
    );
  };

  const skipClosingMood = (prompt: Extract<MoodPrompt, { kind: "close" }>) => {
    const next: MoodPrompt | null = prompt.reason === "switch" ? { kind: "start" } : null;
    if (!openMood) {
      setMoodPrompt(next);
      return;
    }
    void runMood(() => moodsApi.close(openMood), next);
  };

  /** Guarda el timer y, si la sesión arrancó o terminó, pregunta por el mood. */
  const persist = async (next: ErpDayLog) => {
    setError(null);
    const wasActive = Boolean(active);
    const sessionStart = active
      ? clockNow(new Date(active.sessionStartedAt ?? active.startedAt))
      : null;
    try {
      await onPersist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el timer");
      return;
    }
    const isActive = Boolean(next.activeWorkTimer);
    if (!wasActive && isActive) openMoodPrompt({ kind: "start" });
    else if (wasActive && !isActive) openMoodPrompt({ kind: "close", reason: "stop", sessionStart });
  };

  const moodMinutes = openMood ? minutesBetween(openMood.startedAt, clockNow(new Date(nowMs))) : null;

  const openPicker = () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setCategoryOpen(false);
    setPickerOpen(true);
  };

  const scheduleClosePicker = () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    blurTimer.current = window.setTimeout(() => setPickerOpen(false), 140);
  };

  const selectCategory = async (next: WorkCategoryKey | null) => {
    if (next === category) {
      setCategoryOpen(false);
      return;
    }
    setCategory(next);
    setName("");
    setCategoryOpen(false);
    if (active && next) {
      await patchActive({ category: next, name: "" });
    }
  };

  useEffect(() => {
    if (!categoryOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setCategoryOpen(false);
        return;
      }
      if (event.key < "1" || event.key > "9") return;
      const option = CATEGORY_MENU_OPTIONS[Number(event.key) - 1];
      if (!option) return;
      event.preventDefault();
      void selectCategory(option.key);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // selectCategory cierra el menú; alcanza reaccionar a categoryOpen + category
    // eslint-disable-next-line react-hooks/exhaustive-deps -- atajos del menú abierto
  }, [categoryOpen, category, active]);

  const handleStart = async (
    nextCategory: WorkCategoryKey | null = category,
    nextName = name,
  ) => {
    if (!nextCategory) {
      setError("Elegí una categoría o un nombre de la lista");
      return;
    }
    const next = startActiveWorkTimerOnLog(
      todayLog,
      nextCategory,
      nextName,
      Date.now(),
      currentDestino(),
    );
    setCategory(nextCategory);
    setName(nextName.trim());
    setPickerOpen(false);
    await persist(next);
  };

  const handleStop = async () => {
    const next = stopActiveWorkTimerOnLog(todayLog);
    await persist(next);
    setName("");
    setPickerOpen(false);
  };

  const patchActive = async (patch: Partial<ErpActiveWorkTimer>) => {
    if (!active) return;
    await persist({
      ...todayLog,
      activeWorkTimer: { ...active, ...patch },
    });
  };

  const currentDestino = (): ErpTimerDestino => {
    if (destino === "promesa" || destino === "conocimiento") return { timeKind: destino };
    return {};
  };

  /** Play/pausa de una cuota: corta el tramo y abre otro con el nuevo conjunto. */
  const toggleCuota = async (client: string) => {
    const key = client.trim().toLowerCase();
    const exists = openCuotas.some((name) => name.trim().toLowerCase() === key);
    const nextClients = exists
      ? openCuotas.filter((name) => name.trim().toLowerCase() !== key)
      : [...openCuotas, client];
    const next = setActiveCuotasOnLog(todayLog, nextClients, {
      category: category ?? "software",
      name,
      nowMs: Date.now(),
    });
    if (!next.activeWorkTimer) {
      setName("");
      setDestino("");
    } else {
      setDestino("cuota");
    }
    setNowMs(Date.now());
    await persist(next);
  };

  const writeActiveDestino = async (next: ErpTimerDestino) => {
    if (!active) return;
    const clean = readTimerDestino(next);
    const sessionStartedAt = active.sessionStartedAt ?? active.startedAt;
    if (openCuotas.length > 0) {
      // Tenía cuotas: cerrar ese tramo y seguir la sesión con el nuevo destino
      const started = startActiveWorkTimerOnLog(
        todayLog,
        active.category,
        active.name,
        Date.now(),
        clean,
      );
      await persist({
        ...started,
        activeWorkTimer: started.activeWorkTimer
          ? { ...started.activeWorkTimer, sessionStartedAt }
          : null,
      });
      return;
    }
    await persist({
      ...todayLog,
      activeWorkTimer: {
        category: active.category,
        name: active.name,
        startedAt: active.startedAt,
        sessionStartedAt: active.sessionStartedAt,
        items: active.items,
        ...clean,
      },
    });
  };

  const commitName = async () => {
    if (!active) return;
    const trimmed = name.trim().slice(0, 200);
    if (trimmed === active.name) return;
    await patchActive({ name: trimmed });
  };

  const pickName = async (entry: RecentTimer) => {
    const nextCategory = category ?? entry.category;
    setCategory(nextCategory);
    setName(entry.name);
    setPickerOpen(false);
    if (active) {
      const patch: Partial<ErpActiveWorkTimer> = {};
      if (entry.name !== active.name) patch.name = entry.name;
      if (nextCategory !== active.category) patch.category = nextCategory;
      if (Object.keys(patch).length > 0) await patchActive(patch);
      return;
    }
    await handleStart(nextCategory, entry.name);
  };

  const pickRecent = async (entry: RecentTimer) => {
    await pickName(entry);
  };

  const handleAddItem = async () => {
    if (!active) return;
    const text = itemDraft.trim().slice(0, 300);
    if (!text) return;
    setItemDraft("");
    await patchActive({
      items: [...active.items, { id: newWorkTimerItemId(), text, done: false }],
    });
  };

  const toggleItem = async (id: string) => {
    if (!active) return;
    await patchActive({
      items: active.items.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    });
  };

  const removeItem = async (id: string) => {
    if (!active) return;
    await patchActive({
      items: active.items.filter((item) => item.id !== id),
    });
  };

  const onNameKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    opts: { onEnter: () => void },
  ) => {
    if (e.key === "Escape") {
      setPickerOpen(false);
      return;
    }
    if (e.key >= "1" && e.key <= "5" && pickerOpen) {
      const fav = filteredFavorites[Number(e.key) - 1];
      if (fav) {
        e.preventDefault();
        void pickName(fav);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      opts.onEnter();
    }
  };

  const suggestions = (
    <div
      onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
    >
      {filteredFavorites.length > 0 && (
        <div className="px-2 pb-2">
          <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            <Star className="h-3 w-3" />
            Favoritos
          </p>
          <ul>
            {filteredFavorites.map((fav, index) => {
              const meta =
                WORK_CATEGORY_META.find((c) => c.key === fav.category) ??
                categoryMeta;
              return (
                <li key={`${fav.category}::${fav.name.toLowerCase()}`}>
                  <button
                    type="button"
                    onClick={() => void pickName(fav)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-slate-950"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: meta?.color ?? "#94a3b8",
                        }}
                      />
                      <span className="truncate font-semibold">{fav.name}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      {showAllNames && (
                        <span className="text-[11px] font-semibold text-slate-400">
                          {meta?.shortLabel ?? fav.category}
                        </span>
                      )}
                      {index < 5 && (
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] font-semibold text-slate-400">
                          {index + 1}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filteredRecent.length > 0 && (
        <div
          className={`px-2 ${filteredFavorites.length > 0 ? "border-t border-slate-100 pt-2" : ""}`}
        >
          <p className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
            <Clock3 className="h-3 w-3" />
            Recientes
          </p>
          <ul>
            {filteredRecent.map((entry) => {
              const meta = WORK_CATEGORY_META.find(
                (c) => c.key === entry.category,
              );
              return (
                <li key={`${entry.category}-${entry.name}`}>
                  <button
                    type="button"
                    onClick={() => void pickRecent(entry)}
                    className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-slate-950"
                  >
                    <span className="min-w-0 truncate font-semibold text-slate-950">
                      {entry.name}
                    </span>
                    {showAllNames && (
                      <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                        {meta?.shortLabel ?? entry.category}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {filteredFavorites.length === 0 && filteredRecent.length === 0 && (
        <p className="px-4 py-3 text-xs text-slate-400">
          {showAllNames
            ? "Sin nombres guardados"
            : "Sin nombres en esta categoría"}
        </p>
      )}
    </div>
  );

  return (
    <div className={active ? "erp-timer-active-shell" : undefined}>
      <section
        className={
          active
            ? "erp-timer-active-inner p-4 sm:p-5"
            : "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_8px_30px_rgba(15,23,42,0.06)] sm:p-5"
        }
      >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
            Timer live
          </p>
          <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-950">
            {active ? "En curso" : "Empezar a trabajar"}
          </h2>
          <p className="mt-0.5 text-xs font-medium text-slate-600">
            {showAllNames
              ? "Todos los nombres · atajos 1–5"
              : "Nombres de la categoría · atajos 1–5"}
          </p>
        </div>
        {persisting && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            Guardando…
          </span>
        )}
      </div>

      <CuotasTimerStrip
        todayLog={todayLog}
        openClients={openCuotas}
        periodFrom={periodFrom}
        periodTo={periodTo}
        periodLabel={periodLabel}
        nowMs={nowMs}
        persisting={persisting}
        onToggle={(client) => void toggleCuota(client)}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative min-w-0 flex-1" ref={categoryRootRef}>
          <p className="text-xs font-semibold text-slate-800">Categoría</p>
          <button
            type="button"
            onClick={() => {
              setPickerOpen(false);
              setCategoryOpen((open) => !open);
            }}
            className="mt-1 flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-sm font-semibold text-slate-950"
          >
            <span className="inline-flex min-w-0 items-center gap-2">
              {showAllNames ? (
                <span className="inline-flex h-2 w-2 shrink-0 rounded-full border border-dashed border-slate-300" />
              ) : (
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    backgroundColor: categoryMeta?.color ?? "#94a3b8",
                  }}
                />
              )}
              <span
                className={`truncate ${showAllNames ? "font-medium text-slate-500" : ""}`}
              >
                {showAllNames
                  ? "Sin filtrar"
                  : (categoryMeta?.name ?? category)}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                categoryOpen ? "rotate-180" : ""
              }`}
            />
          </button>
          {categoryOpen && (
            <div
              onMouseDown={(e) => e.preventDefault()}
              className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 max-h-80 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-[0_16px_40px_rgba(15,23,42,0.14)]"
            >
              <ul className="px-2">
                {CATEGORY_MENU_OPTIONS.map((option, index) => {
                  const selected = option.key === category;
                  return (
                    <li key={option.key ?? "none"}>
                      <button
                        type="button"
                        onClick={() => void selectCategory(option.key)}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-slate-950"
                      >
                        <span className="inline-flex min-w-0 items-center gap-2">
                          {option.color ? (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: option.color }}
                            />
                          ) : (
                            <span className="inline-flex h-2 w-2 shrink-0 rounded-full border border-dashed border-slate-300" />
                          )}
                          <span
                            className={`truncate ${
                              option.key === null
                                ? "font-medium text-slate-500"
                                : "font-semibold"
                            }`}
                          >
                            {option.name}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          {selected && (
                            <Check className="h-4 w-4 text-blue-600" />
                          )}
                          {index < 9 && (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] font-semibold text-slate-400">
                              {index + 1}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <label className="block text-xs font-semibold text-slate-800">
            Destino
            <select
              value={destino}
              onChange={(e) => {
                const next = e.target.value as "" | "cuota" | ErpTimeKind;
                setDestino(next);
                if (!active || next === "cuota") return;
                if (next === "promesa" || next === "conocimiento") {
                  void writeActiveDestino({ timeKind: next });
                } else {
                  void writeActiveDestino({});
                }
              }}
              className="mt-1 block w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-950"
            >
              <option value="">Sin marcar</option>
              <option value="cuota">Cuota</option>
              <option value="promesa">Promesa</option>
              <option value="conocimiento">Conocimiento</option>
            </select>
          </label>
          {destino === "cuota" ? (
            <p className="mt-2 truncate rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs font-semibold text-slate-900">
              {openCuotas.length === 0
                ? "Tocá un proyecto arriba para empezar"
                : `${openCuotas.length >= 2 ? "Compartido" : "Focus"} · ${openCuotas.join(", ")}`}
            </p>
          ) : null}
        </div>

        <div className="relative min-w-0 flex-[1.5]" ref={pickerRootRef}>
          <label className="block text-xs font-semibold text-slate-800">
            Nombre del timer
            <span className="font-medium text-slate-500"> · opcional</span>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                openPicker();
              }}
              onFocus={openPicker}
              onBlur={() => {
                scheduleClosePicker();
                if (active) void commitName();
              }}
              onKeyDown={(e) =>
                onNameKeyDown(e, {
                  onEnter: () => {
                    if (active) e.currentTarget.blur();
                    else void handleStart();
                  },
                })
              }
              placeholder="Analia, ERP… o elegí de la lista"
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-950 placeholder:font-medium placeholder:text-slate-400"
            />
          </label>
          {pickerOpen && suggestions}
        </div>

        <div className="flex shrink-0 items-end gap-2 sm:gap-3">
          {active || openMood ? (
            <button
              type="button"
              onClick={() =>
                openMoodPrompt(
                  openMood ? { kind: "close", reason: "switch", sessionStart: null } : { kind: "start" },
                )
              }
              title={openMood ? "Cambiar de mood (puntuás el actual)" : "Elegir mood"}
              className={`inline-flex h-[42px] max-w-[14rem] cursor-pointer items-center gap-2 rounded-xl border px-3 text-left text-sm font-semibold ${
                openMood
                  ? "border-blue-200 bg-blue-50 text-blue-900"
                  : "border-dashed border-slate-300 bg-white text-slate-500"
              }`}
            >
              <Headphones className="h-4 w-4 shrink-0" />
              {openMood ? (
                <span className="min-w-0 truncate">
                  {openMood.mood}
                  {moodMinutes !== null ? (
                    <span className="font-medium text-blue-700"> · {formatDuration(moodMinutes)}</span>
                  ) : null}
                </span>
              ) : (
                <span>+ mood</span>
              )}
            </button>
          ) : null}

          <div className="min-w-[8rem] rounded-xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-600">
              Tiempo
            </p>
            <p
              className={`font-mono text-2xl font-bold tracking-tight tabular-nums ${
                active ? "text-slate-950" : "text-slate-700"
              }`}
            >
              {formatSecondsAsClock(elapsed)}
            </p>
          </div>

          {active ? (
            <button
              type="button"
              onClick={() => void handleStop()}
              disabled={persisting}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <Square className="h-4 w-4 fill-current" />
              Detener
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={persisting}
              className="inline-flex h-[42px] items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <Play className="h-4 w-4 fill-current" />
              Iniciar
            </button>
          )}
        </div>
      </div>

      {active && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-bold text-slate-800">Ramas / ítems</p>
          <ul className="space-y-1.5">
            {active.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                <button
                  type="button"
                  onClick={() => void toggleItem(item.id)}
                  disabled={persisting}
                  aria-label={item.done ? "Marcar pendiente" : "Marcar hecho"}
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border cursor-pointer ${
                    item.done
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-white text-slate-300"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <span
                  className={`min-w-0 flex-1 text-sm font-semibold ${
                    item.done ? "text-slate-400 line-through" : "text-slate-950"
                  }`}
                >
                  {item.text}
                </span>
                <button
                  type="button"
                  onClick={() => void removeItem(item.id)}
                  disabled={persisting}
                  aria-label="Quitar ítem"
                  className="rounded-md p-1 text-slate-400 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={itemDraft}
              onChange={(e) => setItemDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleAddItem();
                }
              }}
              placeholder="Ej. conectar wpp · enviar plantilla a revisión"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => void handleAddItem()}
              disabled={persisting || !itemDraft.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Agregar
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm font-medium text-rose-700">{error}</p>}
      </section>

      {moodPrompt?.kind === "start" ? (
        <MoodPromptModal
          key={moodPromptKey}
          mode="start"
          openMoodName={openMood?.mood ?? null}
          recentNames={moodsApi.recentNames}
          busy={moodBusy}
          error={moodError}
          onPick={pickMood}
          onSkip={() => setMoodPrompt(null)}
        />
      ) : null}
      {moodPrompt?.kind === "close" ? (
        <MoodPromptModal
          key={moodPromptKey}
          mode="close"
          initialName={openMood?.mood ?? ""}
          durationLabel={moodMinutes !== null ? formatDuration(moodMinutes) : null}
          saveLabel={moodPrompt.reason === "switch" ? "Guardar y elegir otro" : "Guardar"}
          busy={moodBusy}
          error={moodError}
          onSave={(value) => saveClosingMood(moodPrompt, value)}
          onSkip={() => skipClosingMood(moodPrompt)}
        />
      ) : null}
    </div>
  );
}
