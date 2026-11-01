"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import MonthCalendar from "@/app/admin92/contabilidad/components/MonthCalendar";
import CambiosPendientesSidebar from "@/app/admin92/contabilidad/components/CambiosPendientesSidebar";
import {
  buildDesarrollosCambioItems,
  buildTareasCambioDelMes,
  buildTareasCambioDesarrollos,
  getMesesConCambiosAtrasados,
  sortTareasCambioPorFecha,
  type CambiosSortMode,
  type CuotaCambioItem,
} from "@/app/admin92/contabilidad/lib/cambiosPendientes";
import {
  mapDesarrollo50Doc,
  sortDesarrollos50,
  type Desarrollo50Item,
} from "@/app/admin92/contabilidad/lib/desarrollos50";
import CuotaCalendarDot from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import CuotaOperativaPanel from "@/app/admin92/contabilidad/components/CuotaOperativaPanel";
import CuotaNotaEditor from "@/app/admin92/contabilidad/components/CuotaNotaEditor";
import CuotasDelMesPanel from "@/app/admin92/contabilidad/components/CuotasDelMesPanel";
import RealContableResumen, {
  type RealContableRecord,
} from "@/app/admin92/contabilidad/components/RealContableResumen";
import { buildCalendarMarkers } from "@/app/admin92/contabilidad/lib/calendarMarkers";
import {
  CUOTA_ESTADO_LABEL,
  cuotaEstadoStyles,
  getCuotaEstado,
} from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import {
  buildProyectoByClientMap,
  getCuotaOperativaBorder,
  getProyectoForClient,
  type ProyectoOperativo,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import {
  formatLocalDate,
  formatMonthLabel,
  getMonthKey,
  getMonthKeySafe,
  shiftDate,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";
import type { Cobro } from "@/app/admin92/contabilidad/types";

/** Cuota tal como la devuelve /api/admin/cobros (más campos que el tipo base). */
type CobroFull = Cobro & {
  descripcionCuota?: string;
  cambioPendiente?: boolean;
  requiereEstadisticas?: boolean;
  solicitudTasks?: SolicitudTask[];
};

type Props = {
  cobroId: string;
  dueDate: string;
  onClose: () => void;
  /** Se guardó algo (tareas, cambio, stats, nota): quien abrió el modal puede recargar. */
  onChanged?: () => void;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-AR")} ARS`;
}

function fechaCobroYmd(c: CobroFull): string | null {
  const candidates = [c.fechaCobro, c.paidAt?.slice(0, 10)];
  return candidates.find((d): d is string => Boolean(d && YMD.test(d))) ?? null;
}

/** Solo la descripción propia; la genérica "Cliente - Cuota" repite el nombre y se omite. */
function cuotaDescripcion(c: CobroFull): string {
  const custom = c.descripcionCuota?.trim() ?? "";
  return custom && custom !== `${c.clientName} - Cuota` ? custom : "";
}

/**
 * Calendario de cuotas de Contabilidad en un modal: abre en el mes de la cuota,
 * con su día elegido y la cuota resaltada mostrando cambios, stats y notas.
 */
export default function CuotaCalendarioModal({ cobroId, dueDate, onClose, onChanged }: Props) {
  const initialDate = YMD.test(dueDate) ? dueDate : todayYmd();
  const [month, setMonth] = useState(() => getMonthKeySafe(initialDate));
  const [selectedDate, setSelectedDate] = useState<string | null>(initialDate);
  const [focusedId, setFocusedId] = useState<string | null>(cobroId);
  const [cobros, setCobros] = useState<CobroFull[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOperativo[]>([]);
  const [desarrollos, setDesarrollos] = useState<Desarrollo50Item[]>([]);
  const [records, setRecords] = useState<RealContableRecord[]>([]);
  const [includeChamba, setIncludeChamba] = useState(false);
  const [sortMode, setSortMode] = useState<CambiosSortMode>("tareas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const [cobrosRes, proyectosRes, desarrollosRes, accountingRes] = await Promise.all([
        fetch("/api/admin/cobros", { cache: "no-store" }),
        fetch("/api/admin/proyectos", { cache: "no-store" }),
        fetch("/api/admin/desarrollos-50", { cache: "no-store" }),
        fetch("/api/admin/accounting", { cache: "no-store" }),
      ]);
      const [cobrosData, proyectosData, desarrollosData, accountingData] = await Promise.all([
        cobrosRes.json(),
        proyectosRes.json(),
        desarrollosRes.json(),
        accountingRes.json().catch(() => null),
      ]);
      if (accountingRes.ok && Array.isArray(accountingData?.records)) {
        setRecords(accountingData.records);
      }
      if (desarrollosRes.ok && Array.isArray(desarrollosData?.desarrollos)) {
        setDesarrollos(sortDesarrollos50(desarrollosData.desarrollos.map(mapDesarrollo50Doc)));
      }
      if (!cobrosRes.ok) throw new Error(cobrosData?.error || "No se pudieron cargar las cuotas.");
      const rawCobros: (CobroFull & { _id?: string })[] = Array.isArray(cobrosData?.cobros)
        ? cobrosData.cobros
        : [];
      setCobros(rawCobros.map((c) => ({ ...c, id: c.id || c._id || "" })));
      const rawProyectos: (ProyectoOperativo & { _id?: string })[] = Array.isArray(
        proyectosData?.proyectos,
      )
        ? proyectosData.proyectos
        : [];
      setProyectos(rawProyectos.map((p) => ({ ...p, id: p.id || p._id || "" })));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las cuotas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSaved = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  /** Flechas del teclado cambian el día seleccionado (← → ±1 día, ↑ ↓ ±1 semana), como en Contabilidad */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dayDelta =
        e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowUp"
              ? -7
              : e.key === "ArrowDown"
                ? 7
                : null;
      if (dayDelta === null) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      const base =
        selectedDate ?? (getMonthKeySafe(todayYmd()) === month ? todayYmd() : `${month}-01`);
      const next = shiftDate(base, dayDelta);
      const nextMonth = getMonthKeySafe(next);
      if (nextMonth !== month) setMonth(nextMonth);
      setSelectedDate(next);
      setFocusedId(null);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [month, selectedDate]);

  const cobrosDelMes = useMemo(
    () => cobros.filter((c) => getMonthKeySafe(c.dueDate) === month),
    [cobros, month],
  );
  const recordsDelMes = useMemo(
    () => records.filter((r) => getMonthKey(r.date) === month),
    [records, month],
  );
  const proyectoByClient = useMemo(() => buildProyectoByClientMap(proyectos), [proyectos]);
  const requiereStatsByClient = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const p of proyectoByClient.values()) {
      map.set(p.clientName.trim().toLowerCase(), Boolean(p.requiereEstadisticas));
    }
    return map;
  }, [proyectoByClient]);
  const markers = useMemo(
    () => buildCalendarMarkers([], cobrosDelMes, proyectos, todayYmd()),
    [cobrosDelMes, proyectos],
  );
  const dayCuotas = useMemo(
    () =>
      selectedDate
        ? cobrosDelMes
            .filter((c) => c.dueDate === selectedDate)
            .sort((a, b) => a.clientName.localeCompare(b.clientName, "es"))
        : [],
    [cobrosDelMes, selectedDate],
  );

  // Llevar la cuota elegida a la vista (al abrir y al elegirla en Cambios pendientes)
  useEffect(() => {
    if (loading || !focusedId) return;
    window.requestAnimationFrame(() => {
      document
        .getElementById(`modal-cuota-${focusedId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [loading, focusedId, selectedDate]);

  const today = todayYmd();

  /* Cambios pendientes: mismos datos que la columna de Contabilidad (page.tsx). */
  const cuotasConCambio = useMemo<CuotaCambioItem[]>(() => {
    const fromCobros = cobrosDelMes
      .filter((c) => Boolean(c.cambioPendiente))
      .map((c) => {
        const p = getProyectoForClient(c.clientName, proyectoByClient);
        return {
          id: c.id,
          clientName: c.clientName,
          dueDate: c.dueDate,
          servicio: c.servicio,
          prioridad: c.prioridad,
          estado: getCuotaEstado(c),
          border: getCuotaOperativaBorder(c, p, today),
          source: "cobro" as const,
        };
      });
    return [...fromCobros, ...buildDesarrollosCambioItems(desarrollos, today)];
  }, [cobrosDelMes, proyectoByClient, desarrollos, today]);

  const tareasCambio = useMemo(() => {
    const fromCobros = buildTareasCambioDelMes(cobrosDelMes, (c) => {
      const p = getProyectoForClient(c.clientName, proyectoByClient);
      return { estado: getCuotaEstado(c), border: getCuotaOperativaBorder(c, p, today) };
    });
    return sortTareasCambioPorFecha([...fromCobros, ...buildTareasCambioDesarrollos(desarrollos, today)]);
  }, [cobrosDelMes, proyectoByClient, desarrollos, today]);

  const mesesAtrasados = useMemo(() => getMesesConCambiosAtrasados(cobros, month), [cobros, month]);

  const selectFromSidebar = (c: { id: string; dueDate: string; source?: "cobro" | "desarrollo50" }) => {
    const date = YMD.test(c.dueDate) ? c.dueDate : today;
    setMonth(getMonthKeySafe(date));
    setSelectedDate(date);
    // Los desarrollos 50% no tienen tarjeta en el modal: solo se elige su día
    setFocusedId(c.source === "desarrollo50" ? null : c.id);
  };

  const patchAndReload = async (url: string, body: Record<string, unknown>, fallback: string) => {
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error || fallback);
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    }
    await handleSaved();
  };

  const changePrioridad = (id: string, prioridad: number | undefined) => {
    setCobros((prev) => prev.map((c) => (c.id === id ? { ...c, prioridad } : c)));
    void patchAndReload(
      `/api/admin/cobros/${id}`,
      { prioridad: prioridad ?? null },
      "No se pudo actualizar la prioridad.",
    );
  };

  const dismissTask = (id: string, taskId: string) => {
    const hide = (tasks: SolicitudTask[] | undefined) =>
      (tasks ?? []).map((t) => (t.id === taskId ? { ...t, fueraColaActiva: true } : t));
    const desarrollo = desarrollos.find((d) => d.id === id);
    if (desarrollo) {
      void patchAndReload(
        `/api/admin/desarrollos-50/${id}`,
        { solicitudTasks: hide(desarrollo.solicitudTasks) },
        "No se pudo quitar la tarea de la cola activa.",
      );
      return;
    }
    const cobro = cobros.find((c) => c.id === id);
    if (!cobro) return;
    void patchAndReload(
      `/api/admin/cobros/${id}`,
      { solicitudTasks: hide(cobro.solicitudTasks) },
      "No se pudo quitar la tarea de la cola activa.",
    );
  };

  const sidebarProps = {
    cuotas: cuotasConCambio,
    tareas: tareasCambio,
    mesesAtrasados,
    onGoToMesAtrasado: (monthKey: string) => {
      setMonth(monthKey);
      setSelectedDate(null);
      setFocusedId(null);
    },
    labelFor: (c: CuotaCambioItem) =>
      c.source === "desarrollo50"
        ? `${c.clientName} — ${c.servicio || "Desarrollo"} · 50%`
        : c.servicio
          ? `${c.clientName} (${c.servicio}) - Cuota`
          : `${c.clientName} - Cuota`,
    selectedCobroId: focusedId,
    sortMode,
    onSortModeChange: setSortMode,
    onSelectCuota: selectFromSidebar,
    onPrioridadChange: changePrioridad,
    onDismissTaskFromColaActiva: dismissTask,
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="cuota-calendario-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2
            id="cuota-calendario-title"
            className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950"
          >
            <CalendarDays className="h-5 w-5 text-slate-500" />
            Calendario de cuotas
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {/* Real contable + Flujo de caja del mes del calendario, como en Contabilidad */}
          <RealContableResumen
            records={recordsDelMes}
            monthLabel={formatMonthLabel(month)}
            includeChamba={includeChamba}
            onToggleChamba={() => setIncludeChamba((v) => !v)}
          />

          {/* Calendario + cola de cambios, como en Contabilidad */}
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_minmax(260px,300px)]">
            <MonthCalendar
              month={month}
              selectedDate={selectedDate}
              markers={markers}
              cuotasDelMes={cobrosDelMes.length}
              onSelectDate={(date) => {
                setFocusedId(null);
                setSelectedDate((prev) => (prev === date ? null : date));
              }}
              onPrevMonth={() => {
                setMonth((m) => shiftMonth(m, -1));
                setSelectedDate(null);
                setFocusedId(null);
              }}
              onNextMonth={() => {
                setMonth((m) => shiftMonth(m, 1));
                setSelectedDate(null);
                setFocusedId(null);
              }}
            />
            <CambiosPendientesSidebar className="hidden lg:block" {...sidebarProps} />
          </div>
          <CambiosPendientesSidebar collapsible {...sidebarProps} />

          {loading ? (
            <p className="py-6 text-center text-sm text-slate-500">Cargando cuotas…</p>
          ) : !selectedDate ? (
            <p className="py-4 text-center text-sm text-slate-500">
              Tocá un día del calendario para ver sus cuotas.
            </p>
          ) : dayCuotas.length === 0 ? (
            <p className="py-4 text-center text-sm text-slate-500">
              No hay cuotas el {formatLocalDate(selectedDate)}.
            </p>
          ) : (
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Cuotas del {formatLocalDate(selectedDate)}
              </h3>
              <div className="space-y-3">
                {dayCuotas.map((c) => {
                  const estado = getCuotaEstado(c);
                  const est = cuotaEstadoStyles[estado];
                  const proyecto = getProyectoForClient(c.clientName, proyectoByClient);
                  const border = getCuotaOperativaBorder(c, proyecto, today);
                  const isFocused = focusedId === c.id;
                  return (
                    <div
                      key={c.id}
                      id={`modal-cuota-${c.id}`}
                      className={`rounded-xl border p-3 ${est.card} ${
                        isFocused ? "ring-2 ring-amber-400 border-amber-300" : ""
                      }`}
                    >
                      {/* Cabecera: quién, cuánto y en qué estado; fechas en una línea */}
                      <div className="flex items-start gap-3">
                        <span className="mt-1 shrink-0">
                          <CuotaCalendarDot estado={estado} border={border} size="md" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="truncate text-base font-semibold text-slate-950">
                              {c.clientName}
                            </span>
                            {c.servicio ? (
                              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                                {c.servicio}
                              </span>
                            ) : null}
                          </div>
                          {cuotaDescripcion(c) ? (
                            <p className="mt-0.5 text-sm text-slate-600">{cuotaDescripcion(c)}</p>
                          ) : null}
                          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                            <span
                              className={`rounded-full px-2 py-0.5 font-semibold ${est.badge}`}
                            >
                              {CUOTA_ESTADO_LABEL[estado]}
                            </span>
                            <span>Vence {formatLocalDate(c.dueDate)}</span>
                            {c.paid && fechaCobroYmd(c) ? (
                              <span>· Cobrada {formatLocalDate(fechaCobroYmd(c) as string)}</span>
                            ) : null}
                          </p>
                        </div>
                        <span className={`shrink-0 text-base font-bold tabular-nums ${est.amount}`}>
                          {formatCurrency(c.amount)}
                        </span>
                      </div>
                      <CuotaOperativaPanel
                        cobro={c}
                        proyecto={proyecto}
                        onCobroUpdated={() => void handleSaved()}
                        onProyectoUpdated={handleSaved}
                        compact
                      />
                      <CuotaNotaEditor
                        cobroId={c.id}
                        notes={c.notes}
                        onSaved={() => void handleSaved()}
                        compact
                      />
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Mismo cuadro "Cuotas del mes" de Contabilidad, siguiendo el mes del calendario */}
          <CuotasDelMesPanel
            cobros={cobros}
            month={month}
            requiereStatsByClient={requiereStatsByClient}
            loading={loading}
            onReload={handleSaved}
          />
        </div>
      </article>
    </div>
  );
}
