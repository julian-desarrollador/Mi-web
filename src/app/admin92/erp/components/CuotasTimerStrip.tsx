"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pause, Play } from "lucide-react";
import CuotaCalendarDot from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import { getCuotaEstado, type CuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import {
  buildProyectoByClientMap,
  getCuotaOperativaBorder,
  getProyectoForClient,
  type ProyectoOperativo,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import { cuotaTimerWindow } from "@/app/admin92/contabilidad/lib/cuotaTimers";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";
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
};

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

const VISIBLE_KEY = "erp-timer-cuotas-visible";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

const ESTADO_ORDER: Record<CuotaEstado, number> = {
  pendiente: 0,
  recordada: 1,
  pagada: 2,
};

function clientKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Mismas cuotas que el calendario de contabilidad: las que vencen en el mes activo (el de hoy).
 * Si un cliente tuviera más de una en el mes, queda una sola (la cuya ventana contiene hoy).
 */
function pickCuotasDelMes(cobros: CobroLite[], today: string): CobroLite[] {
  const month = today.slice(0, 7);
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

/** "55 min total · focus 40" o "3:10 total · comp 0:13" (h:mm); omite las partes en 0. */
function breakdownLabel(totalSeconds: number, focusSeconds: number, compSeconds: number): string {
  const short = totalSeconds < 3600;
  const fmt = (s: number) => (short ? String(Math.round(s / 60)) : formatHoursAsHm(s / 3600));
  const isZero = (s: number) => ["0", "0:00"].includes(fmt(s));
  if (isZero(totalSeconds)) return "—";
  const parts = [`${fmt(totalSeconds)}${short ? " min" : ""} total`];
  if (!isZero(focusSeconds)) parts.push(`focus ${fmt(focusSeconds)}`);
  if (!isZero(compSeconds)) parts.push(`comp ${fmt(compSeconds)}`);
  return parts.join(" · ");
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
  const [cobros, setCobros] = useState<CobroLite[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoOperativo[]>([]);
  const [logs, setLogs] = useState<ErpDayLog[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const today = todayYmd();

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VISIBLE_KEY) === "1") setVisible(true);
    } catch {
      /* sin storage */
    }
  }, []);

  const toggleVisible = () => {
    setVisible((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(VISIBLE_KEY, next ? "1" : "0");
      } catch {
        /* sin storage */
      }
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch("/api/admin/cobros").then((res) => res.json()),
      fetch("/api/admin/proyectos").then((res) => res.json()),
    ])
      .then(([cobrosData, proyectosData]) => {
        if (cancelled) return;
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
  }, []);

  const cuotas = useMemo(() => pickCuotasDelMes(cobros, today), [cobros, today]);

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

  const openKeys = useMemo(() => new Set(openClients.map(clientKey)), [openClients]);
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
          running: openKeys.has(clientKey(cobro.clientName)),
          focus,
          compartido,
          todaySeconds: todaySecs.focus + todaySecs.compartido,
        };
      })
      .sort(
        (a, b) =>
          Number(b.running) - Number(a.running) ||
          ESTADO_ORDER[a.estado] - ESTADO_ORDER[b.estado] ||
          a.cobro.clientName.localeCompare(b.cobro.clientName, "es"),
      );
  }, [cuotas, periodLogs, nowMs, today, proyectoByClient, todayLog, openKeys]);

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
          <span className="font-medium text-slate-500"> · totales: {periodLabel}</span>
        </p>
        <button
          type="button"
          onClick={toggleVisible}
          aria-label={visible ? "Ocultar cuotas" : "Mostrar cuotas"}
          title={visible ? "Ocultar cuotas" : "Mostrar cuotas"}
          className="rounded-md p-1 text-amber-500 cursor-pointer"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {visible && (
        <>
          {loadError && <p className="mb-2 text-xs font-medium text-rose-700">{loadError}</p>}
          {chips.length === 0 && !loadError ? (
            <p className="text-xs text-slate-400">Sin cuotas este mes</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
              {chips.map((chip) => {
                const breakdown = breakdownLabel(chip.focus + chip.compartido, chip.focus, chip.compartido);
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
                      <CuotaCalendarDot estado={chip.estado} border={chip.border} />
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
                      className={`truncate text-xs font-medium ${
                        breakdown === "—" ? "text-slate-400" : "text-slate-600"
                      }`}
                    >
                      {breakdown}
                    </span>
                  </button>
                </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
