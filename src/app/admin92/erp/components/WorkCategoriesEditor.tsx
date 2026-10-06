"use client";

import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import {
  formatHoursAsHm,
  normalizeWork,
  normalizeWorkTimers,
  parseDurationToHours,
  readTimerDestino,
  sumWorkHours,
  sumWorkTimerSeconds,
  timerDestinoKey,
  UNNAMED_WORK_TIMER,
  WORK_CATEGORY_META,
  type ErpActiveWorkTimer,
  type ErpDayLog,
  type ErpTimeKind,
  type ErpTimerDestino,
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
  /** Semana o mes: cada fila es un timer de un día y se guarda en ese día. */
  periodLogs?: ErpDayLog[];
  /** Vista de solo lectura */
  readOnly?: boolean;
  /** Texto bajo el título; por defecto la fecha del log. String vacío oculta el renglón. */
  subtitle?: string;
  /** Ocultar categorías sin horas ni timers (Historial). */
  hideEmptyCategories?: boolean;
  /** duration = Categorías; newest = Historial (array se guarda antiguo→nuevo). */
  timerOrder?: "duration" | "newest";
  icons: Record<WorkCategoryKey, ComponentType<{ className?: string }>>;
  activeWorkTimer?: ErpActiveWorkTimer | null;
  onStartLiveTimer?: (
    category: WorkCategoryKey,
    name: string,
    destino?: ErpTimerDestino,
  ) => Promise<void>;
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

type DraftDestino = "" | "cuota" | ErpTimeKind;

function destinoFromDraft(kind: DraftDestino, clients: string[]): ErpTimerDestino {
  if (kind === "cuota") return readTimerDestino({ cuotaClients: clients });
  if (kind === "promesa" || kind === "conocimiento") return { timeKind: kind };
  return {};
}

function destinoCaption(timer: ErpTimerDestino): string | null {
  if (timer.share === "repartido" && timer.cuotaClients && timer.cuotaClients.length >= 2) {
    return `Repartido · ${timer.cuotaClients.join(", ")}`;
  }
  if (timer.cuotaClient) return timer.cuotaClient;
  if (timer.timeKind === "promesa") return "Promesa";
  if (timer.timeKind === "conocimiento") return "Conocimiento";
  return null;
}

let cuotaClientsCache: Promise<string[]> | null = null;

function loadCuotaClientNames(): Promise<string[]> {
  if (!cuotaClientsCache) {
    cuotaClientsCache = fetch("/api/admin/cobros")
      .then((res) => res.json())
      .then((data: { cobros?: { clientName?: string }[] }) => {
        const names = new Set<string>();
        if (Array.isArray(data.cobros)) {
          for (const cobro of data.cobros) {
            const client = cobro.clientName?.trim();
            if (client) names.add(client);
          }
        }
        return [...names].sort((a, b) => a.localeCompare(b, "es"));
      })
      .catch((err: unknown) => {
        cuotaClientsCache = null;
        throw err;
      });
  }
  return cuotaClientsCache;
}

type EditingTarget =
  | { kind: "timer"; category: WorkCategoryKey; index: number; date?: string }
  | { kind: "orphan"; category: WorkCategoryKey; date?: string };

type DeleteConfirm =
  | { kind: "timer"; category: WorkCategoryKey; index: number; name: string; date?: string }
  | { kind: "orphan"; category: WorkCategoryKey; date?: string };

type CategoryRow =
  | { kind: "timer"; timer: ErpWorkTimer; index: number; date?: string }
  | { kind: "orphan"; seconds: number; date?: string };

export default function WorkCategoriesEditor({
  editLog,
  onPersist,
  persisting = false,
  periodLogs,
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
  const [draftDestino, setDraftDestino] = useState<DraftDestino>("");
  const [draftCuotaClients, setDraftCuotaClients] = useState<string[]>([]);
  const [draftCuotasOpen, setDraftCuotasOpen] = useState(true);
  const [cuotaClients, setCuotaClients] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
  const editingRef = useRef<HTMLLIElement | null>(null);

  const workTimers = useMemo(
    () => normalizeWorkTimers(editLog.workTimers),
    [editLog.workTimers],
  );
  const work = useMemo(() => normalizeWork(editLog.work), [editLog.work]);
  const workTotal = sumWorkHours(work);

  const periodRows = useMemo(() => {
    if (!periodLogs) return null;
    const sorted = [...periodLogs].sort((a, b) => b.date.localeCompare(a.date));
    const byCategory = new Map<WorkCategoryKey, CategoryRow[]>();
    for (const meta of WORK_CATEGORY_META) {
      const rows: CategoryRow[] = [];
      for (const log of sorted) {
        const dayTimers = normalizeWorkTimers(log.workTimers)[meta.key] ?? [];
        const hours = normalizeWork(log.work)[meta.key] ?? 0;
        if (dayTimers.length > 0) {
          const listed: CategoryRow[] = dayTimers.map((timer, index) => ({
            kind: "timer",
            timer,
            index,
            date: log.date,
          }));
          listed.sort((a, b) => {
            if (a.kind !== "timer" || b.kind !== "timer") return 0;
            return (
              b.timer.seconds - a.timer.seconds ||
              a.timer.name.localeCompare(b.timer.name, "es")
            );
          });
          rows.push(...listed);
        } else if (hours > 0) {
          rows.push({ kind: "orphan", seconds: Math.round(hours * 3600), date: log.date });
        }
      }
      byCategory.set(meta.key, rows);
    }
    return byCategory;
  }, [periodLogs]);

  const categories = WORK_CATEGORY_META.map((c) => {
    if (periodRows) {
      return {
        ...c,
        hours: work[c.key] ?? 0,
        rows: periodRows.get(c.key) ?? [],
      };
    }
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
    const hours = work[c.key] ?? 0;
    const rows: CategoryRow[] =
      timers.length > 0
        ? timers.map(({ timer, index }) => ({ kind: "timer", timer, index }))
        : hours > 0
          ? [{ kind: "orphan", seconds: Math.round(hours * 3600) }]
          : [];
    return {
      ...c,
      hours,
      rows,
    };
  }).filter((c) => !hideEmptyCategories || c.hours > 0 || c.rows.length > 0);

  const timerKey = (category: WorkCategoryKey, index: number, date?: string) =>
    date ? `${date}:${category}:${index}` : `${category}:${index}`;
  const orphanKey = (category: WorkCategoryKey, date?: string) =>
    date ? `${date}:${category}:orphan` : `${category}:orphan`;

  const parseEditingKey = (key: string | null): EditingTarget | null => {
    if (!key) return null;
    const parts = key.split(":");
    let date: string | undefined;
    let category: string;
    let indexRaw: string;
    if (parts.length === 3) {
      [date, category, indexRaw] = parts;
    } else if (parts.length === 2) {
      [category, indexRaw] = parts;
    } else {
      return null;
    }
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
    if (indexRaw === "orphan") return { kind: "orphan", category, date };
    const index = Number(indexRaw);
    if (!Number.isInteger(index) || index < 0) return null;
    return { kind: "timer", category, index, date };
  };

  const bundleFor = (date?: string) => {
    if (date) {
      const log = periodLogs?.find((item) => item.date === date);
      if (!log) return null;
      return {
        log,
        timers: normalizeWorkTimers(log.workTimers),
        work: normalizeWork(log.work),
      };
    }
    if (periodLogs) return null;
    return { log: editLog, timers: workTimers, work };
  };

  useEffect(() => {
    setEditingKey(null);
    setDeleteConfirm(null);
  }, [editLog.date, readOnly]);

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    void loadCuotaClientNames()
      .then((names) => {
        if (!cancelled) setCuotaClients(names);
      })
      .catch(() => {
        if (!cancelled) setCuotaClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  useEffect(() => {
    const parsed = parseEditingKey(editingKey);
    if (!parsed) return;
    const source = bundleFor(parsed.date);
    if (!source) {
      setEditingKey(null);
      return;
    }
    if (parsed.kind === "orphan") {
      const seconds = Math.round((source.work[parsed.category] ?? 0) * 3600);
      setDraftName(UNNAMED_WORK_TIMER);
      setDraftTime(formatSecondsAsClock(seconds));
      setDraftItems({});
      setDraftDestino("");
      setDraftCuotaClients([]);
      setDraftCuotasOpen(true);
      return;
    }
    const timer = source.timers[parsed.category]?.[parsed.index];
    if (!timer) {
      setEditingKey(null);
      return;
    }
    setDraftName(timer.name);
    setDraftTime(formatSecondsAsClock(timer.seconds));
    const items: Record<string, string> = {};
    for (const item of timer.items ?? []) items[item.id] = item.text;
    setDraftItems(items);
    setDraftCuotasOpen(true);
    if (timer.share === "repartido" && timer.cuotaClients && timer.cuotaClients.length >= 2) {
      setDraftDestino("cuota");
      setDraftCuotaClients(timer.cuotaClients);
    } else if (timer.cuotaClient) {
      setDraftDestino("cuota");
      setDraftCuotaClients([timer.cuotaClient]);
    } else {
      setDraftDestino(timer.timeKind ?? "");
      setDraftCuotaClients([]);
    }
  }, [editingKey, workTimers, work, periodLogs]);

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
  }, [editingKey, deleteConfirm, draftName, draftTime, draftItems, draftDestino, draftCuotaClients, workTimers, work, editLog, periodLogs]);

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
    date?: string,
  ) => {
    const source = bundleFor(date);
    if (!source) return;
    const list = updater([...(source.timers[category] ?? [])]);
    const nextWork = { ...source.work };
    if (list.length === 0) nextWork[category] = 0;
    await persist({
      ...source.log,
      work: nextWork,
      workTimers: { ...source.timers, [category]: list },
    });
  };

  const commitCurrentEdits = async () => {
    const parsed = parseEditingKey(editingKey);
    if (!parsed) return;
    const source = bundleFor(parsed.date);
    if (!source) return;

    let nextName = draftName.trim().slice(0, 200);
    if (!nextName) nextName = UNNAMED_WORK_TIMER;
    const nextSeconds = parseDurationToSeconds(
      draftTime,
      parsed.kind === "orphan"
        ? Math.round((source.work[parsed.category] ?? 0) * 3600)
        : (source.timers[parsed.category]?.[parsed.index]?.seconds ?? 0),
    );

    const destino = destinoFromDraft(draftDestino, draftCuotaClients);

    if (parsed.kind === "orphan") {
      const prevSeconds = Math.round((source.work[parsed.category] ?? 0) * 3600);
      if (
        nextName === UNNAMED_WORK_TIMER &&
        nextSeconds === prevSeconds &&
        timerDestinoKey(destino) === ""
      ) {
        return;
      }
      await persist({
        ...source.log,
        work: { ...source.work, [parsed.category]: nextSeconds / 3600 },
        workTimers: {
          ...source.timers,
          [parsed.category]: [
            {
              name: nextName,
              seconds: nextSeconds,
              items: [],
              ...destino,
            },
          ],
        },
      });
      return;
    }

    const { category, index } = parsed;
    const current = source.timers[category]?.[index];
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
    const destinoChanged = timerDestinoKey(current) !== timerDestinoKey(destino);

    if (!nameChanged && !timeChanged && !itemsChanged && !destinoChanged) return;

    const keptItems = nextItems.length > 0 ? nextItems : current.items;
    await updateTimers(
      category,
      (list) =>
        list.map((t, i) =>
          i === index
            ? {
                name: nextName,
                seconds: nextSeconds,
                ...(keptItems && keptItems.length > 0 ? { items: keptItems } : {}),
                ...destino,
              }
            : t,
        ),
      parsed.date,
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

  const deleteTimer = (category: WorkCategoryKey, index: number, date?: string) => {
    const source = bundleFor(date);
    const current = source?.timers[category]?.[index];
    if (!current) return;
    setDeleteConfirm({
      kind: "timer",
      category,
      index,
      name: current.name,
      date,
    });
  };

  const deleteOrphan = (category: WorkCategoryKey, date?: string) => {
    setDeleteConfirm({ kind: "orphan", category, date });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const pending = deleteConfirm;
    setDeleteConfirm(null);
    setEditingKey(null);
    if (pending.kind === "timer") {
      await updateTimers(
        pending.category,
        (list) => list.filter((_, i) => i !== pending.index),
        pending.date,
      );
      return;
    }
    const source = bundleFor(pending.date);
    if (!source) return;
    await persist({
      ...source.log,
      work: { ...source.work, [pending.category]: 0 },
      workTimers: { ...source.timers, [pending.category]: [] },
    });
  };

  const deleteItem = async (
    category: WorkCategoryKey,
    timerIndex: number,
    itemId: string,
    date?: string,
  ) => {
    setDraftItems((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
    await updateTimers(
      category,
      (list) =>
        list.map((t, i) => {
          if (i !== timerIndex) return t;
          return {
            ...t,
            items: (t.items ?? []).filter((it) => it.id !== itemId),
          };
        }),
      date,
    );
  };

  const clientOptions = (() => {
    const names = new Set(cuotaClients);
    for (const client of draftCuotaClients) {
      const trimmed = client.trim();
      if (trimmed) names.add(trimmed);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "es"));
  })();

  const toggleDraftCuota = (client: string) => {
    setDraftCuotaClients((prev) => {
      const exists = prev.some((name) => name.trim().toLowerCase() === client.trim().toLowerCase());
      const next = exists
        ? prev.filter((name) => name.trim().toLowerCase() !== client.trim().toLowerCase())
        : [...prev, client];
      return clientOptions.filter((name) =>
        next.some((picked) => picked.trim().toLowerCase() === name.trim().toLowerCase()),
      );
    });
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
      <div className="grid gap-1.5 sm:grid-cols-2">
        <label className="block text-[11px] font-semibold text-slate-800">
          Destino
          <select
            value={draftDestino}
            disabled={persisting}
            onChange={(e) => {
              const next = e.target.value as DraftDestino;
              setDraftDestino(next);
              if (next === "cuota") setDraftCuotasOpen(true);
              else setDraftCuotaClients([]);
            }}
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
            className="mt-1 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-950"
          >
            <option value="">Sin marcar</option>
            <option value="cuota">Cuota</option>
            <option value="promesa">Promesa</option>
            <option value="conocimiento">Conocimiento</option>
          </select>
        </label>
        {draftDestino === "cuota" ? (
          <div>
            <button
              type="button"
              aria-expanded={draftCuotasOpen}
              onClick={() => setDraftCuotasOpen((open) => !open)}
              className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-left text-[11px] font-semibold text-slate-900"
            >
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-slate-900 transition ${draftCuotasOpen ? "" : "-rotate-90"}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block">
                  Cuotas
                  {draftCuotaClients.length >= 2 ? " · repartido" : " · una es focus"}
                </span>
                <span className="block truncate font-medium">
                  {draftCuotaClients.length === 0 ? "Ninguna" : draftCuotaClients.join(", ")}
                </span>
              </span>
            </button>
            {draftCuotasOpen ? (
            <ul className="mt-1 max-h-32 overflow-y-auto rounded-lg border border-slate-300 bg-white p-1">
              {clientOptions.map((client) => {
                const checked = draftCuotaClients.some(
                  (name) => name.trim().toLowerCase() === client.trim().toLowerCase(),
                );
                return (
                  <li key={client}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs font-medium text-slate-900">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={persisting}
                        onChange={() => toggleDraftCuota(client)}
                        className="h-3.5 w-3.5 accent-[#1d4ed8]"
                      />
                      <span className="min-w-0 truncate">{client}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            ) : null}
          </div>
        ) : null}
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
                    void deleteItem(parsed.category, parsed.index, item.id, parsed.date);
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
                  {cat.rows.length === 0 ? (
                    <li className="text-xs font-medium text-slate-500">Sin desglose de timers</li>
                  ) : (
                    cat.rows.map((row) => {
                      if (row.kind === "orphan") {
                        const key = orphanKey(cat.key, row.date);
                        if (editingKey === key) {
                          return renderEditorRow(
                            key,
                            () => void deleteOrphan(cat.key, row.date),
                            "Eliminar horas sin desglose",
                          );
                        }
                        const orphanBody = (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-xs font-semibold text-amber-800">
                                Horas sin desglose
                              </span>
                              <span className="shrink-0 font-mono text-xs font-semibold text-slate-950">
                                {formatSecondsAsClock(row.seconds)}
                              </span>
                            </div>
                            {row.date ? (
                              <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                                {formatLocalDate(row.date)}
                              </p>
                            ) : (
                              <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                                Click para nombrar o editar este tiempo
                              </p>
                            )}
                          </>
                        );
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
                                <div className="min-w-0 flex-1 rounded-lg px-1.5 py-1">{orphanBody}</div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => startEdit(key)}
                                  className="min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 text-left transition hover:bg-slate-50"
                                >
                                  {orphanBody}
                                </button>
                              )}
                            </div>
                          </li>
                        );
                      }

                      const { timer, index, date } = row;
                      const key = timerKey(cat.key, index, date);
                      if (editingKey === key) {
                        return renderEditorRow(
                          key,
                          () => void deleteTimer(cat.key, index, date),
                          `Eliminar ${timer.name}`,
                          timer.items,
                        );
                      }
                      const caption = destinoCaption(timer);
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
                          {date ? (
                            <p className="mt-0.5 text-[11px] font-medium text-slate-600">
                              {formatLocalDate(date)}
                            </p>
                          ) : null}
                          {caption ? (
                            <p className="mt-0.5 text-[11px] font-medium text-slate-600">{caption}</p>
                          ) : null}
                          {(timer.items ?? []).length > 0 && (
                            <ul className="mt-1 space-y-0.5 pl-2">
                              {(timer.items ?? []).map((item) => (
                                <li
                                  key={item.id}
                                  className={`truncate text-[11px] ${
                                    item.done ? "text-slate-400 line-through" : "text-slate-600"
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
                        <li key={key}>
                          <div className="flex items-start gap-1.5">
                            {onStartLiveTimer && (
                              <LiveTimerPlayButton
                                category={cat.key}
                                name={timer.name}
                                destino={
                                  timer.cuotaClient ||
                                  (timer.cuotaClients && timer.cuotaClients.length >= 2) ||
                                  timer.timeKind
                                    ? readTimerDestino(timer)
                                    : undefined
                                }
                                activeWorkTimer={activeWorkTimer}
                                onToggle={onStartLiveTimer}
                                disabled={timerSaving}
                              />
                            )}
                            {readOnly ? (
                              <div className="min-w-0 flex-1 rounded-lg px-1.5 py-1">{timerBody}</div>
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
