import { normalizePrueba, type LeadPrueba } from "@/app/admin92/contabilidad/lib/leads";
import {
  getTaskSortDate,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";

export type Desarrollo50Item = {
  id: string;
  clientName: string;
  name: string;
  type: string;
  fechaCobro50?: string;
  montoCobrado50?: number;
  accountingRecordId?: string;
  cambioPendiente?: boolean;
  solicitudTasks?: SolicitudTask[];
  /** Servicio tal cual está guardado (type muestra "—" si falta) */
  servicio?: string;
  telefono?: string;
  origen?: string;
  prueba?: LeadPrueba;
  pruebaInicio?: string;
};

/** Punto en el calendario: cobro histórico y/o alerta por Ped. abierta */
export type Desarrollo50DotMarker = {
  date: string;
  cambioPendiente: boolean;
};

export function mapDesarrollo50Doc(raw: {
  _id?: string;
  id?: string;
  clientName: string;
  name: string;
  servicio?: string;
  fechaCobro50?: string;
  montoCobrado50?: number;
  accountingRecordId?: string;
  cambioPendiente?: boolean;
  solicitudTasks?: SolicitudTask[];
  telefono?: string | null;
  origen?: string | null;
  prueba?: string | null;
  pruebaInicio?: string | null;
}): Desarrollo50Item {
  return {
    id: raw._id ?? raw.id ?? "",
    clientName: raw.clientName,
    name: raw.name,
    type: raw.servicio || "—",
    fechaCobro50: raw.fechaCobro50,
    montoCobrado50: raw.montoCobrado50,
    accountingRecordId: raw.accountingRecordId,
    cambioPendiente: Boolean(raw.cambioPendiente),
    solicitudTasks: Array.isArray(raw.solicitudTasks) ? raw.solicitudTasks : undefined,
    servicio: raw.servicio || undefined,
    telefono: raw.telefono || undefined,
    origen: raw.origen || undefined,
    prueba: normalizePrueba(raw.prueba),
    pruebaInicio: raw.pruebaInicio || undefined,
  };
}

export function sortDesarrollos50(items: Desarrollo50Item[]): Desarrollo50Item[] {
  return [...items].sort((a, b) => {
    const fa = a.fechaCobro50 || "";
    const fb = b.fechaCobro50 || "";
    if (fa !== fb) return fb.localeCompare(fa);
    return a.clientName.localeCompare(b.clientName);
  });
}

type DesarrolloAlertLike = {
  fechaCobro50?: string;
  solicitudTasks?: SolicitudTask[];
};

/**
 * Fecha del anillo ámbar: Ped. más antigua de una tarea abierta.
 * Si no hay tareas abiertas → fallback `today`.
 */
export function getDesarrollo50AlertDate(
  d: DesarrolloAlertLike,
  today: string,
): string {
  const anchor =
    d.fechaCobro50 && /^\d{4}-\d{2}-\d{2}$/.test(d.fechaCobro50)
      ? d.fechaCobro50
      : today;
  let oldest: string | null = null;
  for (const t of d.solicitudTasks ?? []) {
    if (t.done || t.fueraColaActiva) continue;
    const ped = getTaskSortDate(t, anchor);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ped)) continue;
    if (!oldest || ped < oldest) oldest = ped;
  }
  if (oldest) return oldest;
  return /^\d{4}-\d{2}-\d{2}$/.test(today) ? today : anchor;
}

/**
 * Markers: siempre en fechaCobro50; si hay cambio pendiente,
 * también en la Ped. más vieja abierta (o hoy si no hay tareas).
 */
export function buildDesarrollo50CalendarDots(
  items: Array<{
    fechaCobro50?: string;
    cambioPendiente?: boolean;
    solicitudTasks?: SolicitudTask[];
  }>,
  today: string,
): Desarrollo50DotMarker[] {
  const dots: Desarrollo50DotMarker[] = [];
  for (const d of items) {
    const fecha = d.fechaCobro50;
    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) continue;
    const cambio = Boolean(d.cambioPendiente);
    dots.push({ date: fecha, cambioPendiente: cambio });
    if (!cambio) continue;
    const alertDate = getDesarrollo50AlertDate(d, today);
    if (alertDate !== fecha) {
      dots.push({ date: alertDate, cambioPendiente: true });
    }
  }
  return dots;
}
