"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, Pause, Play, Search, Undo2, X } from "lucide-react";
import ErpUpdatesModal from "@/app/admin92/erp/components/ErpUpdatesModal";
import CuotaCalendarDot from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import CuotaCalendarioModal from "@/app/admin92/contabilidad/components/CuotaCalendarioModal";
import { getCuotaEstado, type CuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import {
  buildProyectoByClientMap,
  getCuotaOperativaBorder,
  getProyectoForClient,
  getTaskSortDate,
  hasMejorasPendientes,
  isCuotaSaas,
  type CuotaOperativaBorder,
  type ProyectoOperativo,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import { cuotaTimerWindow } from "@/app/admin92/contabilidad/lib/cuotaTimers";
import { useCuotaTimerRows } from "@/app/admin92/contabilidad/lib/useCuotaTimerRows";
import { formatMonthLabel, MONTH_NAMES, shiftMonth, todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import {
  formatHoursAsHm,
  todaySecondsForCuota,
  type ErpDayLog,
} from "@/app/admin92/erp/lib/erpTypes";
import { formatSecondsAsClock } from "@/app/admin92/erp/lib/parseWorkTimersPaste";

type CobroLite = {
  id: string;
  clientName: string;
  dueDate: string;
  paid: boolean;
  fechaCobro?: string;
  recordatorioEnviado?: boolean;
  estadisticasEnviadas?: boolean;
  cambioPendiente?: boolean;
  requiereEstadisticas?: boolean;
  solicitudTasks?: SolicitudTask[];
  mejoraPendiente?: boolean;
  mejorasPendientes?: SolicitudTask[];
};

/** Cuándo se pidió el cambio: la tarea pendiente más antigua (o la más antigua, si están todas hechas). */
function cambioRequestDate(cobro: CobroLite): string {
  const tasks = cobro.solicitudTasks ?? [];
  const pending = tasks.filter((task) => !task.done);
  const dates = (pending.length > 0 ? pending : tasks).map((task) =>
    getTaskSortDate(task, cobro.dueDate),
  );
  return dates.length > 0 ? dates.reduce((min, d) => (d < min ? d : min)) : cobro.dueDate;
}

type Props = {
  todayLog: ErpDayLog;
  /** Cuotas abiertas ahora (orden indistinto) */
  openClients: string[];
  /** Período del desglose (Día / Semana / Mes elegido abajo) */
  periodFrom: string;
  periodTo: string;
  periodLabel: string;
  nowMs: number;
  persisting: boolean;
  onToggle: (clientName: string) => void;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const GRID_CLASS = "grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2";

const ESTADO_ORDER: Record<CuotaEstado, number> = {
  pendiente: 0,
  recordada: 1,
  pagada: 2,
};

/** Dentro de las pagadas: primero con cambios, luego con estadísticas, al final sin nada. */
const PAGADA_BORDER_ORDER: Record<CuotaOperativaBorder, number> = {
  both: 0,
  cambio: 0,
  stats: 1,
  none: 2,
};

function clientKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Minúsculas y sin acentos, para buscar sin importar cómo se escribió. */
function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Mismas cuotas que el calendario de contabilidad: las que vencen en el mes elegido
 * (por defecto, el de hoy). Si un cliente tuviera más de una en el mes, queda una sola
 * (la cuya ventana contiene hoy, o la primera).
 */
function pickCuotasDelMes(cobros: CobroLite[], month: string, today: string): CobroLite[] {
  const byClient = new Map<string, CobroLite[]>();
  for (const cobro of cobros) {
    const key = clientKey(cobro.clientName);
    if (!key || !YMD.test(cobro.dueDate) || cobro.dueDate.slice(0, 7) !== month) continue;
    byClient.set(key, [...(byClient.get(key) ?? []), cobro]);
  }
  const out: CobroLite[] = [];
  for (const list of byClient.values()) {
    const sorted = [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const current = sorted.find((c) => {
      const window = cuotaTimerWindow(c.dueDate);
      return today >= window.from && today <= window.to;
    });
    out.push(current ?? sorted[0]);
  }
  return out;
}

const formatSecondsAsHm = (seconds: number) => formatHoursAsHm(Math.max(0, seconds) / 3600);

/** "0:55 total  0:22 focus  0:32 comp" (h:mm); la misma línea para el período y el ciclo. */
function CuotaHoursLine({ focus, compartido }: { focus: number; compartido: number }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-xs font-semibold tabular-nums">
      <span className="text-slate-900">{formatSecondsAsHm(focus + compartido)} total</span>
      <span className="text-emerald-700">{formatSecondsAsHm(focus)} focus</span>
      <span className="text-violet-700">{formatSecondsAsHm(compartido)} comp</span>
    </span>
  );
}

export default function CuotasTimerStrip({
  todayLog,
  openClients,
  periodFrom,
  periodTo,
  periodLabel,
  nowMs,
  persisting,
  onToggle,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [cuotaQuery, setCuotaQuery] = useState("");
  const [cobros, setCobros] = useState<CobroLite[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOperativo[]>([]);
  const [logs, setLogs] = useState<ErpDayLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const today = todayYmd();
  /** Meses de desplazamiento respecto del actual (0 = sigue al mes de hoy, aunque cambie). */
  const [monthOffset, setMonthOffset] = useState(0);
  const currentMonth = today.slice(0, 7);
  const viewMonth = shiftMonth(currentMonth, monthOffset);

  /* Siempre arranca oculto; mostrar/ocultar no se recuerda entre recargas. */
  const toggleVisible = () => setVisible((prev) => !prev);

  /** Reloj: suma a cada tarjeta las horas del ciclo de la cuota, debajo de las del período de abajo. */
  const [showCuotaTimes, setShowCuotaTimes] = useState(false);
  const toggleCuotaTimes = () =>
    setShowCuotaTimes((prev) => {
      if (!prev) setVisible(true);
      return !prev;
    });

  const [calendarCobro, setCalendarCobro] = useState<{ id?: string; dueDate: string } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const reloadCuotas = useCallback(() => setReloadKey((key) => key + 1), []);
  const closeCalendar = useCallback(() => setCalendarCobro(null), []);

  /* Updates listas para entregar (ícono de caja) */
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const [updatesCount, setUpdatesCount] = useState(0);
  const closeUpdates = useCallback(() => setUpdatesOpen(false), []);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/erp-updates", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.updates)) {
          // Solo las pendientes (sin tildar como entregadas)
          setUpdatesCount(data.updates.filter((u: { entregada?: boolean }) => !u.entregada).length);
        }
      })
      .catch(() => {
        /* el badge es opcional */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const proyectoSuggestions = useMemo(
    () => Array.from(new Set(cobros.map((c) => c.clientName.trim()).filter(Boolean))),
    [cobros],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/admin/cobros", { cache: "no-store" }).then((res) => res.json()),
      fetch("/api/admin/proyectos", { cache: "no-store" }).then((res) => res.json()),
    ])
      .then(([cobrosData, proyectosData]) => {
        if (cancelled) return;
        setLoadError(null);
        const rawCobros: (CobroLite & { _id?: string })[] = Array.isArray(cobrosData?.cobros)
          ? cobrosData.cobros
          : [];
        setCobros(
          rawCobros
            .filter((c) => typeof c.clientName === "string" && c.clientName.trim())
            .map((c) => ({ ...c, id: c.id || c._id || "" })),
        );
        const rawProyectos: (ProyectoOperativo & { _id?: string })[] = Array.isArray(
          proyectosData?.proyectos,
        )
          ? proyectosData.proyectos
          : [];
        setProyectos(rawProyectos.map((p) => ({ ...p, id: p.id || p._id || "" })));
      })
      .catch(() => {
        if (!cancelled) setLoadError("No se pudieron cargar las cuotas.");
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const cuotas = useMemo(
    () => pickCuotasDelMes(cobros, viewMonth, today),
    [cobros, viewMonth, today],
  );

  useEffect(() => {
    if (!YMD.test(periodFrom) || !YMD.test(periodTo) || periodFrom > periodTo) return;
    const controller = new AbortController();
    void fetch(`/api/admin/erp-logs?from=${periodFrom}&to=${periodTo}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { logs?: ErpDayLog[]; error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar las horas.");
        setLogs(data.logs ?? []);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(error instanceof Error ? error.message : "No se pudieron cargar las horas.");
      });
    return () => controller.abort();
  }, [periodFrom, periodTo]);

  // El log de hoy viene de props para que el tramo en curso esté al día; en días
  // pasados se ignora un timer activo olvidado (como en contabilidad).
  const periodLogs = useMemo(() => {
    const inRange: ErpDayLog[] = logs
      .filter((log) => log.date >= periodFrom && log.date <= periodTo && log.date !== todayLog.date)
      .map((log) => ({ ...log, activeWorkTimer: null }));
    if (todayLog.date >= periodFrom && todayLog.date <= periodTo) inRange.push(todayLog);
    return inRange;
  }, [logs, todayLog, periodFrom, periodTo]);

  const proyectoByClient = useMemo(() => buildProyectoByClientMap(proyectos), [proyectos]);

  const cuotaTimerInputs = useMemo(
    () => cuotas.map((c) => ({ id: c.id, clientName: c.clientName, dueDate: c.dueDate })),
    [cuotas],
  );
  const cuotaTimers = useCuotaTimerRows(cuotaTimerInputs, showCuotaTimes, {
    liveTodayLog: todayLog,
    nowMs,
  });
  const cuotaTimeById = useMemo(
    () => new Map(cuotaTimers.rows.map((row) => [row.id, row])),
    [cuotaTimers.rows],
  );

  const openKeys = useMemo(() => new Set(openClients.map(clientKey)), [openClients]);
  /** Posición de cada cuota en curso según el orden en que se abrió. */
  const openIndex = useMemo(
    () => new Map(openClients.map((name, index) => [clientKey(name), index])),
    [openClients],
  );
  const parallel = openKeys.size >= 2;

  const chips = useMemo(() => {
    return cuotas
      .map((cobro) => {
        const proyecto = getProyectoForClient(cobro.clientName, proyectoByClient);
        const todaySecs = todaySecondsForCuota(todayLog, cobro.clientName, nowMs);
        let focus = 0;
        let compartido = 0;
        for (const log of periodLogs) {
          const part = todaySecondsForCuota(log, cobro.clientName, nowMs);
          focus += part.focus;
          compartido += part.compartido;
        }
        return {
          cobro,
          estado: getCuotaEstado(cobro),
          border: getCuotaOperativaBorder(cobro, proyecto, today),
          mejora: hasMejorasPendientes(cobro),
          running: openKeys.has(clientKey(cobro.clientName)),
          focus,
          compartido,
          todaySeconds: todaySecs.focus + todaySecs.compartido,
        };
      })
      .sort(
        (a, b) =>
          Number(b.running) - Number(a.running) ||
          // En curso: en el orden en que se abrieron (la última, al final)
          (a.running && b.running
            ? (openIndex.get(clientKey(a.cobro.clientName)) ?? 0) -
              (openIndex.get(clientKey(b.cobro.clientName)) ?? 0)
            : 0) ||
          ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado] ||
          (a.estado === "pagada" && b.estado === "pagada"
            ? PAGADA_BORDER_ORDER[a.border] - PAGADA_BORDER_ORDER[b.border] ||
              // Pagadas con cambio: el pedido más antiguo primero
              (PAGADA_BORDER_ORDER[a.border] === 0
                ? cambioRequestDate(a.cobro).localeCompare(cambioRequestDate(b.cobro))
                : 0)
            : 0) ||
          a.cobro.clientName.localeCompare(b.cobro.clientName, "es"),
      );
  }, [cuotas, periodLogs, nowMs, today, proyectoByClient, todayLog, openKeys, openIndex]);

  const visibleChips = useMemo(() => {
    const terms = normalizeSearch(cuotaQuery).split(/\s+/).filter(Boolean);
    if (terms.length === 0) return chips;
    return chips.filter((chip) => {
      const haystack = normalizeSearch(chip.cobro.clientName);
      return terms.every((term) => haystack.includes(term));
    });
  }, [chips, cuotaQuery]);

  const runningChips = visibleChips.filter((chip) => chip.running);
  const pausedChips = visibleChips.filter((chip) => !chip.running);

  const renderChip = (chip: (typeof chips)[number]) => {
    return (
    <li key={chip.cobro.id || chip.cobro.clientName}>
      <button
        type="button"
        onClick={() => onToggle(chip.cobro.clientName)}
        disabled={persisting}
        aria-pressed={chip.running}
        title={`${chip.cobro.clientName} · ${chip.running ? "Pausar" : "Iniciar"}`}
        className={`flex h-full w-full cursor-pointer flex-col gap-1 rounded-xl border bg-white px-2.5 py-2 text-left transition disabled:cursor-wait disabled:opacity-70 ${
          chip.running ? "border-blue-300 shadow-sm ring-1 ring-blue-200" : "border-slate-200"
        }`}
      >
        <span className="flex items-center gap-2">
          {/* El puntito abre el calendario; el resto del cuadro es play/pausa */}
          <span
            role="button"
            tabIndex={0}
            aria-label={`Ver ${chip.cobro.clientName} en el calendario`}
            title="Ver en el calendario"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              setCalendarCobro({ id: chip.cobro.id, dueDate: chip.cobro.dueDate });
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.stopPropagation();
              event.preventDefault();
              setCalendarCobro({ id: chip.cobro.id, dueDate: chip.cobro.dueDate });
            }}
            className="-m-1 inline-flex shrink-0 cursor-pointer rounded-full p-1"
          >
            <CuotaCalendarDot
              estado={chip.estado}
              border={chip.border}
              mejora={chip.mejora}
              saas={isCuotaSaas(chip.cobro.clientName)}
            />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950">
            {chip.cobro.clientName}
          </span>
          {chip.running && (
            <span
              className={`rounded-full px-1.5 py-px text-[10px] font-bold uppercase ${
                parallel ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {parallel ? "comp" : "focus"}
            </span>
          )}
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
              chip.running ? "border-blue-300 text-blue-700" : "border-slate-200 text-slate-400"
            }`}
          >
            {chip.running ? (
              <Pause className="h-3 w-3 fill-current" />
            ) : (
              <Play className="ml-px h-3 w-3 fill-current" />
            )}
          </span>
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span
            className={`font-mono text-sm font-bold tabular-nums ${
              chip.running
                ? "text-blue-700"
                : chip.todaySeconds > 0
                  ? "text-slate-900"
                  : "text-slate-300"
            }`}
          >
            {formatSecondsAsClock(chip.todaySeconds)}
          </span>
          <span
            title={`Cuota que vence el ${chip.cobro.dueDate.split("-").reverse().join("/")}`}
            className={`shrink-0 rounded px-1 text-[10px] font-semibold uppercase tracking-wide ${
              chip.cobro.dueDate.slice(0, 7) === today.slice(0, 7)
                ? "text-slate-500"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {MONTH_NAMES[Number(chip.cobro.dueDate.slice(5, 7)) - 1].slice(0, 3)}
          </span>
        </span>
        {/* Lo trabajado en la pestaña Día / Semana / Mes elegida abajo */}
        {formatSecondsAsHm(chip.focus + chip.compartido) === "0:00" ? (
          <span className="text-xs font-medium text-slate-400">—</span>
        ) : (
          <CuotaHoursLine focus={chip.focus} compartido={chip.compartido} />
        )}
        {showCuotaTimes
          ? (() => {
              const row = cuotaTimeById.get(chip.cobro.id);
              const { from, to } = cuotaTimerWindow(chip.cobro.dueDate);
              // "2026-10-09" → "09/10"
              const dm = (ymd: string) => ymd.slice(5).split("-").reverse().join("/");
              return (
                <span
                  title={`Suma lo trabajado del ${dm(from)} al ${dm(to)}`}
                  className="flex flex-col gap-0.5 border-t border-dashed border-slate-200 pt-1"
                >
                  <span className="text-[10px] font-medium tabular-nums text-slate-400">
                    Ciclo {dm(from)} → {dm(to)}
                  </span>
                  {cuotaTimers.loading && !row ? (
                    <span className="text-xs font-medium text-slate-400">…</span>
                  ) : (
                    <CuotaHoursLine
                      focus={row?.seconds ?? 0}
                      compartido={row?.repartidoSeconds ?? 0}
                    />
                  )}
                </span>
              );
            })()
          : null}
      </button>
    </li>
    );
  };

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-800">
          Proyectos
          {openKeys.size > 0 && (
            <span className="font-medium text-slate-500">
              {" "}
              · {openKeys.size} en curso{parallel ? " · compartido" : " · focus"}
            </span>
          )}
          <span className="font-medium text-slate-500">
            {" "}
            · totales: {periodLabel}
          </span>
        </p>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <button
            type="button"
            onClick={() =>
              // Abre en el mes que se está mirando (hoy si es el mes actual)
              setCalendarCobro({ dueDate: viewMonth === currentMonth ? today : `${viewMonth}-01` })
            }
            aria-label="Abrir calendario de cuotas"
            title="Calendario de cuotas"
            className="flex h-6 w-6 items-center justify-center rounded-md text-base leading-none cursor-pointer hover:bg-slate-100"
          >
            <span aria-hidden>📅</span>
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setUpdatesOpen(true)}
              aria-label={`Updates para entregar${updatesCount > 0 ? ` (${updatesCount})` : ""}`}
              title="Updates para entregar"
              className="relative flex h-6 w-6 items-center justify-center rounded-md text-base leading-none cursor-pointer hover:bg-slate-100"
            >
              <span aria-hidden>📦</span>
              {updatesCount > 0 ? (
                <span className="absolute -right-1 -top-1 min-w-[14px] rounded-full bg-amber-600 px-1 text-center text-[9px] font-bold leading-[14px] text-white">
                  {updatesCount}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={toggleCuotaTimes}
              aria-label={showCuotaTimes ? "Ocultar ciclo de cada cuota" : "Ver ciclo de cada cuota"}
              aria-pressed={showCuotaTimes}
              title={showCuotaTimes ? "Ocultar ciclo de cada cuota" : "Ver ciclo de cada cuota (de vencimiento a vencimiento)"}
              className={`flex h-6 w-6 items-center justify-center rounded-md cursor-pointer ${
                showCuotaTimes ? "bg-blue-700 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Clock className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={toggleVisible}
              aria-label={visible ? "Ocultar cuotas" : "Mostrar cuotas"}
              title={visible ? "Ocultar cuotas" : "Mostrar cuotas"}
              className="flex h-6 w-6 items-center justify-center rounded-md text-base leading-none cursor-pointer hover:bg-slate-100"
            >
              <span aria-hidden>{visible ? "🙈" : "👁️"}</span>
            </button>
          </div>
        </div>
      </div>

      {visible && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <button
              type="button"
              onClick={() => setMonthOffset((offset) => offset - 1)}
              aria-label="Mes anterior"
              title="Mes anterior"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[5.5rem] text-center text-xs font-semibold capitalize text-blue-700">
              {formatMonthLabel(viewMonth).split(" ")[0]}
            </span>
            <button
              type="button"
              onClick={() => setMonthOffset((offset) => offset + 1)}
              aria-label="Mes siguiente"
              title="Mes siguiente"
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {monthOffset !== 0 && (
              <button
                type="button"
                onClick={() => setMonthOffset(0)}
                aria-label={`Volver a ${formatMonthLabel(currentMonth)}`}
                title={`Volver a ${formatMonthLabel(currentMonth)}`}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-blue-700 shadow-sm transition hover:bg-blue-100 hover:border-blue-300 active:scale-95 cursor-pointer"
              >
                <Undo2 className="h-3.5 w-3.5" />
              </button>
            )}
            <div className="relative ml-1 w-40">
              <Search
                className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden
              />
              <input
                type="search"
                value={cuotaQuery}
                onChange={(event) => setCuotaQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape" && cuotaQuery) {
                    event.stopPropagation();
                    setCuotaQuery("");
                  }
                }}
                placeholder="Buscar cliente…"
                aria-label="Buscar cuota"
                style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
                className="w-full rounded-lg border border-slate-300 py-1 pl-7 pr-7 text-xs focus:border-transparent focus:ring-2 focus:ring-[#84b9ed] [&::-webkit-search-cancel-button]:hidden"
              />
              {cuotaQuery ? (
                <button
                  type="button"
                  onClick={() => setCuotaQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          {loadError && <p className="mb-2 text-xs font-medium text-rose-700">{loadError}</p>}
          {showCuotaTimes && cuotaTimers.error && (
            <p className="mb-2 text-xs font-medium text-rose-700">{cuotaTimers.error}</p>
          )}
          {chips.length === 0 && !loadError ? (
            <p className="text-xs text-slate-400">
              Sin cuotas en {formatMonthLabel(viewMonth)}
            </p>
          ) : visibleChips.length === 0 && chips.length > 0 ? (
            <p className="text-xs text-slate-400">Ninguna cuota coincide.</p>
          ) : chips.length > 0 ? (
            <>
              {runningChips.length > 0 && (
                <ul className={GRID_CLASS}>{runningChips.map(renderChip)}</ul>
              )}
              {runningChips.length > 0 && pausedChips.length > 0 && (
                <hr className="my-3 border-t border-slate-300" />
              )}
              {pausedChips.length > 0 && (
                <ul className={GRID_CLASS}>{pausedChips.map(renderChip)}</ul>
              )}
            </>
          ) : null}
        </>
      )}

      {calendarCobro ? (
        <CuotaCalendarioModal
          cobroId={calendarCobro.id}
          dueDate={calendarCobro.dueDate}
          onClose={closeCalendar}
          onChanged={reloadCuotas}
        />
      ) : null}

      {updatesOpen ? (
        <ErpUpdatesModal
          onClose={closeUpdates}
          onCountChange={setUpdatesCount}
          proyectoSuggestions={proyectoSuggestions}
        />
      ) : null}
    </div>
  );
}
