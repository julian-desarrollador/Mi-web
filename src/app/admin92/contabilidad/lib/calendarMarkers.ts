import type { AccountingType } from "@/app/admin92/contabilidad/types";
import { getRecordDateStr } from "@/app/admin92/contabilidad/lib/utils";
import { getCuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import {
  buildProyectoByClientMap,
  getCuotaOperativaBorder,
  getProyectoForClient,
  type CuotaDotMarker,
  type ProyectoOperativo,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";

export type { CuotaDotMarker };

export type DayMarkerTypes = {
  inversion: boolean;
  cuotas: CuotaDotMarker[];
};

export type CalendarMarkers = Record<string, DayMarkerTypes>;

type RecordLike = {
  type: AccountingType;
  date: string;
};

type CobroLike = {
  id: string;
  dueDate: string;
  clientName: string;
  paid: boolean;
  fechaCobro?: string;
  recordatorioEnviado?: boolean;
  estadisticasEnviadas?: boolean;
  requiereEstadisticas?: boolean;
  cambioPendiente?: boolean;
};

function emptyDayMarkers(): DayMarkerTypes {
  return { inversion: false, cuotas: [] };
}

export function buildCalendarMarkers(
  records: RecordLike[],
  cobrosDelMes: CobroLike[] = [],
  proyectos: ProyectoOperativo[] = [],
  today?: string,
): CalendarMarkers {
  const proyectoMap = buildProyectoByClientMap(proyectos);
  const todayStr =
    today ??
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

  const markers: CalendarMarkers = {};
  for (const r of records) {
    if (r.type !== "inversion") continue;
    const day = getRecordDateStr(r.date);
    if (!markers[day]) markers[day] = emptyDayMarkers();
    markers[day].inversion = true;
  }
  for (const c of cobrosDelMes) {
    const day = c.dueDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
    if (!markers[day]) markers[day] = emptyDayMarkers();
    const proyecto = getProyectoForClient(c.clientName, proyectoMap);
    const estado = getCuotaEstado(c);
    const border = getCuotaOperativaBorder(c, proyecto, todayStr);
    markers[day].cuotas.push({ id: c.id, estado, border });
  }
  return markers;
}
