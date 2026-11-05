import type { CuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import type { CuotaOperativaBorder } from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import {
  getTaskFechaRealizada,
  getTaskSortDate,
  hasMejorasPendientes,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import { getDesarrollo50AlertDate } from "@/app/admin92/contabilidad/lib/desarrollos50";
import { getMonthKeySafe } from "@/app/admin92/contabilidad/lib/utils";

export type CambiosSortMode = "fecha" | "prioridad" | "tareas" | "saas";

export type CuotaCambioItem = {
  id: string;
  clientName: string;
  dueDate: string;
  servicio?: string;
  prioridad?: number;
  estado: CuotaEstado;
  border: CuotaOperativaBorder;
  /** Tiene mejoras sin hacer (anillo cian) */
  mejora?: boolean;
  /** Origen del ítem en la cola (default: cuota) */
  source?: "cobro" | "desarrollo50";
};

export type CambioTaskListItem = {
  taskId: string;
  text: string;
  done: boolean;
  fecha: string;
  fechaRealizada?: string;
  cobroId: string;
  clientName: string;
  dueDate: string;
  servicio?: string;
  estado: CuotaEstado;
  border: CuotaOperativaBorder;
  mejora?: boolean;
  source?: "cobro" | "desarrollo50";
};

type CuotaMeta = { estado: CuotaEstado; border: CuotaOperativaBorder; mejora?: boolean };

type CobroConTareas = {
  id: string;
  clientName: string;
  dueDate: string;
  servicio?: string;
  paid: boolean;
  fechaCobro?: string;
  recordatorioEnviado?: boolean;
  estadisticasEnviadas?: boolean;
  cambioPendiente?: boolean;
  solicitudTasks?: SolicitudTask[];
  mejoraPendiente?: boolean;
  mejorasPendientes?: SolicitudTask[];
};

type CobroCambioLike = {
  dueDate: string;
  cambioPendiente?: boolean;
};

type CobroMejoraLike = {
  dueDate: string;
  mejoraPendiente?: boolean;
  mejorasPendientes?: SolicitudTask[];
};

export function buildTareasCambioDelMes(
  cobros: CobroConTareas[],
  metaFor: (c: CobroConTareas) => CuotaMeta,
): CambioTaskListItem[] {
  return buildTaskItems(
    cobros.filter((c) => c.cambioPendiente),
    (c) => c.solicitudTasks,
    metaFor,
  );
}

/** Igual que buildTareasCambioDelMes, con las tareas de la mejora */
export function buildMejorasDelMes(
  cobros: CobroConTareas[],
  metaFor: (c: CobroConTareas) => CuotaMeta,
): CambioTaskListItem[] {
  return buildTaskItems(
    cobros.filter((c) => hasMejorasPendientes(c)),
    (c) => c.mejorasPendientes,
    metaFor,
  );
}

function buildTaskItems(
  cobros: CobroConTareas[],
  tasksOf: (c: CobroConTareas) => SolicitudTask[] | undefined,
  metaFor: (c: CobroConTareas) => CuotaMeta,
): CambioTaskListItem[] {
  const items: CambioTaskListItem[] = [];
  for (const c of cobros) {
    const tasks = tasksOf(c) ?? [];
    if (tasks.length === 0) continue;
    const { estado, border, mejora } = metaFor(c);
    for (const t of tasks) {
      if (t.fueraColaActiva) continue;
      items.push({
        taskId: t.id,
        text: t.text,
        done: t.done,
        fecha: getTaskSortDate(t, c.dueDate),
        fechaRealizada: getTaskFechaRealizada(t) ?? undefined,
        cobroId: c.id,
        clientName: c.clientName,
        dueDate: c.dueDate,
        servicio: c.servicio,
        estado,
        border,
        mejora,
      });
    }
  }
  return sortTareasCambioPorFecha(items);
}

type DesarrolloCambioLike = {
  id: string;
  clientName: string;
  name: string;
  type?: string;
  fechaCobro50?: string;
  cambioPendiente?: boolean;
  solicitudTasks?: SolicitudTask[];
};

/** Desarrollos 50% activos con cambio pendiente → ítems de cola Fecha/Prioridad */
export function buildDesarrollosCambioItems(
  desarrollos: DesarrolloCambioLike[],
  today: string,
): CuotaCambioItem[] {
  return desarrollos
    .filter((d) => Boolean(d.cambioPendiente))
    .map((d) => {
      const alertDate = getDesarrollo50AlertDate(d, today);
      return {
        id: d.id,
        clientName: d.clientName,
        dueDate: alertDate,
        servicio: d.name,
        estado: "pagada" as const,
        border: "cambio" as const,
        source: "desarrollo50" as const,
      };
    });
}

/** Tareas de desarrollos 50% con cambio pendiente (cola Tareas) */
export function buildTareasCambioDesarrollos(
  desarrollos: DesarrolloCambioLike[],
  today: string,
): CambioTaskListItem[] {
  const items: CambioTaskListItem[] = [];
  for (const d of desarrollos) {
    if (!d.cambioPendiente) continue;
    const tasks = d.solicitudTasks ?? [];
    if (tasks.length === 0) continue;
    const alertDate = getDesarrollo50AlertDate(d, today);
    const anchor =
      d.fechaCobro50 && /^\d{4}-\d{2}-\d{2}$/.test(d.fechaCobro50)
        ? d.fechaCobro50
        : today;
    for (const t of tasks) {
      if (t.fueraColaActiva) continue;
      items.push({
        taskId: t.id,
        text: t.text,
        done: t.done,
        fecha: getTaskSortDate(t, anchor),
        fechaRealizada: getTaskFechaRealizada(t) ?? undefined,
        cobroId: d.id,
        clientName: d.clientName,
        dueDate: alertDate,
        servicio: d.name,
        estado: "pagada",
        border: "cambio",
        source: "desarrollo50",
      });
    }
  }
  return sortTareasCambioPorFecha(items);
}

export function sortTareasCambioPorFecha(items: CambioTaskListItem[]): CambioTaskListItem[] {
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.done && b.done) {
      const fa = a.fechaRealizada ?? a.fecha;
      const fb = b.fechaRealizada ?? b.fecha;
      const byRealizada = fa.localeCompare(fb);
      if (byRealizada !== 0) return byRealizada;
    } else {
      const byFecha = a.fecha.localeCompare(b.fecha);
      if (byFecha !== 0) return byFecha;
    }
    const byCuota = a.dueDate.localeCompare(b.dueDate);
    if (byCuota !== 0) return byCuota;
    return a.text.localeCompare(b.text);
  });
}

/** Cuotas con cambio abierto en meses anteriores al mes visible del calendario */
export function countCambiosAtrasados(cobros: CobroCambioLike[], monthKey: string): number {
  return cobros.filter(
    (c) => Boolean(c.cambioPendiente) && getMonthKeySafe(c.dueDate) < monthKey,
  ).length;
}

export type MesCambiosAtrasados = {
  monthKey: string;
  count: number;
};

/** Meses (anteriores al visible) con al menos una cuota con cambio pendiente */
export function getMesesConCambiosAtrasados(
  cobros: CobroCambioLike[],
  monthKey: string,
): MesCambiosAtrasados[] {
  return countByMonthBefore(cobros.filter((c) => c.cambioPendiente), monthKey);
}

/** Meses (anteriores al visible) con al menos una cuota con mejora pendiente */
export function getMesesConMejorasAtrasadas(
  cobros: CobroMejoraLike[],
  monthKey: string,
): MesCambiosAtrasados[] {
  return countByMonthBefore(cobros.filter((c) => hasMejorasPendientes(c)), monthKey);
}

function countByMonthBefore(cobros: { dueDate: string }[], monthKey: string): MesCambiosAtrasados[] {
  const byMonth = new Map<string, number>();
  for (const c of cobros) {
    const mk = getMonthKeySafe(c.dueDate);
    if (mk >= monthKey) continue;
    byMonth.set(mk, (byMonth.get(mk) ?? 0) + 1);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mk, count]) => ({ monthKey: mk, count }));
}

const PRIORIDAD_SIN_ASIGNAR = 9999;

export function sortCuotasCambiosPendientes<T extends CuotaCambioItem>(
  cuotas: T[],
  mode: CambiosSortMode,
): T[] {
  const copy = [...cuotas];
  if (mode === "fecha") {
    return copy.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  if (mode === "prioridad") {
    return copy.sort((a, b) => {
      const pa = a.prioridad ?? PRIORIDAD_SIN_ASIGNAR;
      const pb = b.prioridad ?? PRIORIDAD_SIN_ASIGNAR;
      if (pa !== pb) return pa - pb;
      return a.dueDate.localeCompare(b.dueDate);
    });
  }
  return copy;
}
