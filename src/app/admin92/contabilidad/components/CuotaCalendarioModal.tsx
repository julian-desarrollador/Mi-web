"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, X } from "lucide-react";
import MonthCalendar from "@/app/admin92/contabilidad/components/MonthCalendar";
import CambiosPendientesSidebar from "@/app/admin92/contabilidad/components/CambiosPendientesSidebar";
import {
  buildDesarrollosCambioItems,
  buildMejorasDelMes,
  buildTareasCambioDelMes,
  buildTareasCambioDesarrollos,
  getMesesConCambiosAtrasados,
  getMesesConMejorasAtrasadas,
  sortTareasCambioPorFecha,
  type CambiosSortMode,
  type CuotaCambioItem,
} from "@/app/admin92/contabilidad/lib/cambiosPendientes";
import {
  mapDesarrollo50Doc,
  sortDesarrollos50,
  type Desarrollo50Item,
} from "@/app/admin92/contabilidad/lib/desarrollos50";
import ConfirmarPagoCobro from "@/app/admin92/contabilidad/components/ConfirmarPagoCobro";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import CuotaCalendarDot from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import CuotaOperativaPanel from "@/app/admin92/contabilidad/components/CuotaOperativaPanel";
import CuotaNotaEditor from "@/app/admin92/contabilidad/components/CuotaNotaEditor";
import CuotasDelMesPanel from "@/app/admin92/contabilidad/components/CuotasDelMesPanel";
import { computeCobranzaKpis } from "@/app/admin92/contabilidad/lib/cobranza";
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
  CUOTA_TASK_FIELDS,
  getCuotaOperativaBorder,
  getProyectoForClient,
  hasMejorasPendientes,
  isCuotaSaas,
  type CuotaTaskKind,
  type ProyectoOperativo,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import {
  appsDesdeCobros,
  mismaAplicacion,
  type AplicacionRef,
} from "@/app/admin92/contabilidad/lib/mejorasGenerales";
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
import { useCuotaTimerRows } from "@/app/admin92/contabilidad/lib/useCuotaTimerRows";

/** Cuota tal como la devuelve /api/admin/cobros (más campos que el tipo base). */
type CobroFull = Cobro & {
  descripcionCuota?: string;
  cambioPendiente?: boolean;
  requiereEstadisticas?: boolean;
  solicitudTasks?: SolicitudTask[];
  mejoraPendiente?: boolean;
  mejorasPendientes?: SolicitudTask[];
};

type Props = {
  /** Cuota a resaltar al abrir (opcional: sin ella se abre solo en la fecha) */
  cobroId?: string;
  dueDate: string;
  onClose: () => void;
  /** Se guardó algo (tareas, cambio, stats, nota): quien abrió el modal puede recargar. */
  onChanged?: () => void;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;

function nowHm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Texto chico del recordatorio. Sin hora si el dato es viejo. */
function recordatorioLabel(fecha?: string, hora?: string): string {
  if (!fecha || !YMD.test(fecha)) return "Recordada";
  const day = formatLocalDate(fecha);
  if (hora && HM.test(hora)) return `Recordada el ${day} · ${hora}`;
  return `Recordada el ${day}`;
}

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
  const [focusedId, setFocusedId] = useState<string | null>(cobroId || null);
  // Qué pestaña abrir en la cuota elegida desde la columna lateral
  const [focusedKind, setFocusedKind] = useState<CuotaTaskKind>("cambio");
  const [cobros, setCobros] = useState<CobroFull[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOperativo[]>([]);
  const [desarrollos, setDesarrollos] = useState<Desarrollo50Item[]>([]);
  const [records, setRecords] = useState<RealContableRecord[]>([]);
  const [includeChamba, setIncludeChamba] = useState(false);
  const [sortMode, setSortMode] = useState<CambiosSortMode>("tareas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingPaid, setPendingPaid] = useState<CobroFull | null>(null);
  const [paidFecha, setPaidFecha] = useState(todayYmd());
  const [confirmingPaid, setConfirmingPaid] = useState(false);
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
      if (event.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-label="Elegir fecha"]')) return;
      if (pendingPaid) {
        setPendingPaid(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, pendingPaid]);

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
      if (document.querySelector('[role="dialog"][aria-label="Elegir fecha"]')) return;
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
  /* Reloj del calendario: horas de cada cuota (total · focus · compartido) */
  const [cuotaTimersOpen, setCuotaTimersOpen] = useState(false);
  const cuotaTimerInputs = useMemo(
    () => cobrosDelMes.map((c) => ({ id: c.id, clientName: c.clientName, dueDate: c.dueDate })),
    [cobrosDelMes],
  );
  const cuotaTimers = useCuotaTimerRows(cuotaTimerInputs, cuotaTimersOpen);
  const recordsDelMes = useMemo(
    () => records.filter((r) => getMonthKey(r.date) === month),
    [records, month],
  );
  const cobranza = useMemo(
    () =>
      computeCobranzaKpis(
        cobros,
        month,
        new Map(records.filter((r) => r._id).map((r) => [r._id as string, r.date] as const)),
        includeChamba,
      ),
    [cobros, month, records, includeChamba],
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
  const cuotaItem = useCallback(
    (c: CobroFull): CuotaCambioItem => {
      const p = getProyectoForClient(c.clientName, proyectoByClient);
      return {
        id: c.id,
        clientName: c.clientName,
        dueDate: c.dueDate,
        servicio: c.servicio,
        prioridad: c.prioridad,
        estado: getCuotaEstado(c),
        border: getCuotaOperativaBorder(c, p, today),
        mejora: hasMejorasPendientes(c),
        source: "cobro",
      };
    },
    [proyectoByClient, today],
  );

  const cuotasConCambio = useMemo<CuotaCambioItem[]>(() => {
    const fromCobros = cobrosDelMes.filter((c) => Boolean(c.cambioPendiente)).map(cuotaItem);
    return [...fromCobros, ...buildDesarrollosCambioItems(desarrollos, today)];
  }, [cobrosDelMes, cuotaItem, desarrollos, today]);

  const tareasCambio = useMemo(() => {
    const fromCobros = buildTareasCambioDelMes(cobrosDelMes, (c) => {
      const p = getProyectoForClient(c.clientName, proyectoByClient);
      return {
        estado: getCuotaEstado(c),
        border: getCuotaOperativaBorder(c, p, today),
        mejora: hasMejorasPendientes(c),
      };
    });
    return sortTareasCambioPorFecha([...fromCobros, ...buildTareasCambioDesarrollos(desarrollos, today)]);
  }, [cobrosDelMes, proyectoByClient, desarrollos, today]);

  /* Mejoras: lo mismo que cambios, con sus propios campos. */
  const mejoras = useMemo(
    () => ({
      cuotas: cobrosDelMes.filter((c) => hasMejorasPendientes(c)).map(cuotaItem),
      tareas: buildMejorasDelMes(cobrosDelMes, (c) => {
        const p = getProyectoForClient(c.clientName, proyectoByClient);
        return {
          estado: getCuotaEstado(c),
          border: getCuotaOperativaBorder(c, p, today),
          mejora: true,
        };
      }),
      mesesAtrasados: getMesesConMejorasAtrasadas(cobros, month),
    }),
    [cobrosDelMes, cuotaItem, proyectoByClient, today, cobros, month],
  );

  const mesesAtrasados = useMemo(() => getMesesConCambiosAtrasados(cobros, month), [cobros, month]);

  const selectFromSidebar = (
    c: { id: string; dueDate: string; source?: "cobro" | "desarrollo50" },
    kind: CuotaTaskKind,
  ) => {
    const date = YMD.test(c.dueDate) ? c.dueDate : today;
    setMonth(getMonthKeySafe(date));
    setSelectedDate(date);
    setFocusedKind(kind);
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

  const markPaid = (c: CobroFull) => {
    if (c.paid) {
      void patchAndReload(`/api/admin/cobros/${c.id}`, { paid: false }, "No se pudo marcar la cuota como pendiente.");
      return;
    }
    setPendingPaid(c);
    setPaidFecha(todayYmd());
  };

  const confirmPaid = async () => {
    if (!pendingPaid || !YMD.test(paidFecha)) return;
    setConfirmingPaid(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cobros/${pendingPaid.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true, fechaIngreso: paidFecha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo marcar la cuota como pagada.");
        return;
      }
      setPendingPaid(null);
      await handleSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar la cuota como pagada.");
    } finally {
      setConfirmingPaid(false);
    }
  };

  const markRecordatorio = (c: CobroFull, on: boolean) => {
    if (!on) {
      void patchAndReload(
        `/api/admin/cobros/${c.id}`,
        { recordatorioEnviado: false },
        "No se pudo quitar el recordatorio.",
      );
      return;
    }
    void patchAndReload(
      `/api/admin/cobros/${c.id}`,
      {
        recordatorioEnviado: true,
        fechaRecordatorio:
          c.fechaRecordatorio && YMD.test(c.fechaRecordatorio) ? c.fechaRecordatorio : todayYmd(),
        horaRecordatorio:
          c.horaRecordatorio && HM.test(c.horaRecordatorio) ? c.horaRecordatorio : nowHm(),
      },
      "No se pudo marcar el recordatorio.",
    );
  };

  const setFechaRecordatorio = (id: string, ymd: string) => {
    if (!YMD.test(ymd)) return;
    void patchAndReload(
      `/api/admin/cobros/${id}`,
      { fechaRecordatorio: ymd },
      "No se pudo guardar el día del recordatorio.",
    );
  };

  const setHoraRecordatorio = (id: string, hm: string) => {
    if (!HM.test(hm)) return;
    void patchAndReload(
      `/api/admin/cobros/${id}`,
      { horaRecordatorio: hm },
      "No se pudo guardar la hora del recordatorio.",
    );
  };

  const changePrioridad = (id: string, prioridad: number | undefined) => {
    setCobros((prev) => prev.map((c) => (c.id === id ? { ...c, prioridad } : c)));
    void patchAndReload(
      `/api/admin/cobros/${id}`,
      { prioridad: prioridad ?? null },
      "No se pudo actualizar la prioridad.",
    );
  };

  const dismissTask = (id: string, taskId: string, kind: CuotaTaskKind) => {
    const hide = (tasks: SolicitudTask[] | undefined) =>
      (tasks ?? []).map((t) => (t.id === taskId ? { ...t, fueraColaActiva: true } : t));
    const desarrollo = kind === "cambio" ? desarrollos.find((d) => d.id === id) : undefined;
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
    const field = CUOTA_TASK_FIELDS[kind].tasks;
    void patchAndReload(
      `/api/admin/cobros/${id}`,
      { [field]: hide(cobro[field]) },
      "No se pudo quitar la tarea de la cola activa.",
    );
  };

  const aplicacionesDisponibles = useMemo(() => appsDesdeCobros(cobros), [cobros]);

  const selectAplicacion = (app: AplicacionRef) => {
    const matches = cobros.filter((c) => mismaAplicacion(c, app));
    const inMonth = matches.filter((c) => getMonthKeySafe(c.dueDate) === month);
    const target = inMonth[0] ?? [...matches].sort((a, b) => b.dueDate.localeCompare(a.dueDate))[0];
    if (!target) return;
    selectFromSidebar(target, "mejora");
  };

  const sidebarProps = {
    cuotas: cuotasConCambio,
    tareas: tareasCambio,
    mejoras,
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
    aplicacionesDisponibles,
    onSelectAplicacion: selectAplicacion,
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
            cobranza={cobranza}
            collapsible
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
              cuotaTimersOpen={cuotaTimersOpen}
              onToggleCuotaTimers={() => setCuotaTimersOpen((open) => !open)}
              cuotaTimerRows={cuotaTimers.rows}
              cuotaTimersLoading={cuotaTimers.loading}
              cuotaTimersError={cuotaTimers.error}
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
              {pendingPaid ? (
                <ConfirmarPagoCobro
                  cobro={pendingPaid}
                  fechaCobro={paidFecha}
                  onFechaCobroChange={setPaidFecha}
                  onConfirm={() => void confirmPaid()}
                  onCancel={() => setPendingPaid(null)}
                  confirming={confirmingPaid}
                  formatCurrency={formatCurrency}
                />
              ) : null}
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
                          <CuotaCalendarDot
                            estado={estado}
                            border={border}
                            mejora={hasMejorasPendientes(c)}
                            saas={isCuotaSaas(c.clientName)}
                            size="md"
                          />
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
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {!c.paid ? (
                          <button
                            type="button"
                            onClick={() => markRecordatorio(c, !c.recordatorioEnviado)}
                            aria-pressed={Boolean(c.recordatorioEnviado)}
                            className={`inline-flex cursor-pointer items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${
                              c.recordatorioEnviado
                                ? "border-blue-500 bg-blue-100 text-blue-800"
                                : "border-slate-300 bg-white text-slate-600"
                            }`}
                          >
                            {c.recordatorioEnviado ? "Recordada" : "Marcar recordada"}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => markPaid(c)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                            c.paid
                              ? "border-slate-300 bg-white text-slate-600"
                              : "border-green-300 bg-green-50 text-green-800"
                          }`}
                        >
                          {c.paid ? "Marcar pendiente" : "Marcar pagada"}
                        </button>
                      </div>
                      {!c.paid && c.recordatorioEnviado ? (
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <DatePickerField
                            aria-label="Día en que se recordó"
                            value={
                              c.fechaRecordatorio && YMD.test(c.fechaRecordatorio)
                                ? c.fechaRecordatorio
                                : ""
                            }
                            onChange={(ymd) => {
                              if (!ymd || ymd === c.fechaRecordatorio) return;
                              setFechaRecordatorio(c.id, ymd);
                            }}
                            className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-900"
                          />
                              <input
                                type="time"
                                aria-label="Hora en que se recordó"
                                step={60}
                                key={`${c.id}-hora-rec-${c.horaRecordatorio ?? ""}`}
                                defaultValue={
                                  c.horaRecordatorio && HM.test(c.horaRecordatorio)
                                    ? c.horaRecordatorio
                                    : ""
                                }
                                onBlur={(event) => {
                                  const next = event.target.value;
                                  if (!next || next === c.horaRecordatorio) return;
                                  setHoraRecordatorio(c.id, next.slice(0, 5));
                                }}
                                className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-700"
                              />
                        </div>
                      ) : null}
                      {c.recordatorioEnviado ? (
                        <p className="mt-1 text-[11px] leading-tight text-slate-500">
                          {recordatorioLabel(c.fechaRecordatorio, c.horaRecordatorio)}
                        </p>
                      ) : null}
                      <CuotaOperativaPanel
                        cobro={c}
                        proyecto={proyecto}
                        onCobroUpdated={() => void handleSaved()}
                        onProyectoUpdated={handleSaved}
                        compact
                        tabHint={isFocused ? focusedKind : undefined}
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
