import type { CuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import { shiftDate } from "@/app/admin92/contabilidad/lib/utils";

export type SolicitudTask = {
  id: string;
  text: string;
  done: boolean;
  /** Fecha de creación YYYY-MM-DD (orden en cola de tareas) */
  createdAt?: string;
  /** Oculta en Cambios pendientes (Tareas); sigue visible en Cola operativa */
  fueraColaActiva?: boolean;
  /** Fecha en que se completó la tarea, YYYY-MM-DD */
  fechaRealizada?: string;
};

export type ProyectoOperativo = {
  id: string;
  clientName: string;
  status?: string;
  requiereEstadisticas?: boolean;
  cambioPendiente?: boolean;
  solicitudTasks?: SolicitudTask[];
  ultimaSolicitud?: string;
};

export type CuotaOperativaBorder = "none" | "cambio" | "stats" | "both";

export type CuotaDotMarker = {
  id: string;
  estado: CuotaEstado;
  border: CuotaOperativaBorder;
};

const STATS_OFFSET_DAYS = 5;

export function normalizeClientName(name: string): string {
  return String(name || "").trim().toLowerCase();
}

export function buildProyectoByClientMap(
  proyectos: ProyectoOperativo[],
): Map<string, ProyectoOperativo> {
  const map = new Map<string, ProyectoOperativo>();
  for (const p of proyectos) {
    const key = normalizeClientName(p.clientName);
    const cur = map.get(key);
    if (!cur) {
      map.set(key, p);
      continue;
    }
    if (cur.status === "archivado" && p.status !== "archivado") {
      map.set(key, p);
    }
  }
  return map;
}

export function getProyectoForClient(
  clientName: string,
  map: Map<string, ProyectoOperativo>,
): ProyectoOperativo | null {
  return map.get(normalizeClientName(clientName)) ?? null;
}

export function getStatsObjectiveDate(cobro: {
  paid: boolean;
  fechaCobro?: string;
  dueDate: string;
}): string | null {
  if (!cobro.paid) return null;
  const base = cobro.fechaCobro || cobro.dueDate;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) return null;
  return shiftDate(base, STATS_OFFSET_DAYS);
}

export function hasCambioPendiente(cobro: { cambioPendiente?: boolean }): boolean {
  return Boolean(cobro.cambioPendiente);
}

export function cobroRequiereEstadisticas(
  cobro: { requiereEstadisticas?: boolean },
  proyecto: ProyectoOperativo | null | undefined,
): boolean {
  if (cobro.requiereEstadisticas !== undefined) {
    return Boolean(cobro.requiereEstadisticas);
  }
  return Boolean(proyecto?.requiereEstadisticas);
}

export function hasStatsPendientes(
  cobro: {
    paid: boolean;
    fechaCobro?: string;
    dueDate: string;
    estadisticasEnviadas?: boolean;
    requiereEstadisticas?: boolean;
  },
  proyecto: ProyectoOperativo | null | undefined,
  _today: string,
): boolean {
  if (!cobroRequiereEstadisticas(cobro, proyecto)) return false;
  if (!cobro.paid || cobro.estadisticasEnviadas) return false;
  const base = cobro.fechaCobro || cobro.dueDate;
  return /^\d{4}-\d{2}-\d{2}$/.test(base);
}

export function getCuotaOperativaBorder(
  cobro: {
    paid: boolean;
    fechaCobro?: string;
    dueDate: string;
    estadisticasEnviadas?: boolean;
    cambioPendiente?: boolean;
    requiereEstadisticas?: boolean;
  },
  proyecto: ProyectoOperativo | null | undefined,
  today: string,
): CuotaOperativaBorder {
  const cambio = hasCambioPendiente(cobro);
  const stats = hasStatsPendientes(cobro, proyecto, today);
  if (cambio && stats) return "both";
  if (cambio) return "cambio";
  if (stats) return "stats";
  return "none";
}

export function newSolicitudTaskId(): string {
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Fecha para ordenar tareas (creación, id legacy o vencimiento de cuota) */
export function getTaskSortDate(task: SolicitudTask, cuotaDueDate: string): string {
  if (task.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(task.createdAt)) {
    return task.createdAt;
  }
  const m = /^t_(\d+)_/.exec(task.id);
  if (m) {
    const d = new Date(Number(m[1]));
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return cuotaDueDate;
}

export function getTaskFechaRealizada(task: SolicitudTask): string | null {
  if (task.fechaRealizada && /^\d{4}-\d{2}-\d{2}$/.test(task.fechaRealizada)) {
    return task.fechaRealizada;
  }
  return null;
}

export function normalizeSolicitudTask(
  task: SolicitudTask,
  cuotaDueDate: string,
): SolicitudTask {
  const normalized: SolicitudTask = {
    id: task.id,
    text: task.text,
    done: task.done,
    createdAt: getTaskSortDate(task, cuotaDueDate),
  };
  if (task.fueraColaActiva) normalized.fueraColaActiva = true;
  if (task.done) {
    const fr = getTaskFechaRealizada(task);
    if (fr) normalized.fechaRealizada = fr;
  }
  return normalized;
}

export function sortSolicitudTasksByFecha(
  tasks: SolicitudTask[],
  cuotaDueDate: string,
): SolicitudTask[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) {
      const fa = getTaskFechaRealizada(a) ?? getTaskSortDate(a, cuotaDueDate);
      const fb = getTaskFechaRealizada(b) ?? getTaskSortDate(b, cuotaDueDate);
      const byRealizada = fa.localeCompare(fb);
      if (byRealizada !== 0) return byRealizada;
    } else {
      const byFecha = getTaskSortDate(a, cuotaDueDate).localeCompare(
        getTaskSortDate(b, cuotaDueDate),
      );
      if (byFecha !== 0) return byFecha;
    }
    return a.text.localeCompare(b.text);
  });
}
