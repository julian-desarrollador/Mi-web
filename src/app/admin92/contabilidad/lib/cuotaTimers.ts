import {
  elapsedActiveSeconds,
  formatHoursAsHm,
  normalizeActiveWorkTimer,
  normalizeWorkTimers,
  repartidoSecondsForClient,
  type ErpDayLog,
  type ErpWorkTimer,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import { shiftDate, shiftMonth, todayYmd } from "@/app/admin92/contabilidad/lib/utils";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export type CuotaTimerInput = {
  id: string;
  clientName: string;
  dueDate: string;
};

export type CuotaTimerRow = CuotaTimerInput & {
  seconds: number;
  repartidoSeconds: number;
  hoursLabel: string;
  repartidoLabel: string;
};

function clientKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Día siguiente al mismo vencimiento del mes anterior, hasta el día que vence. */
export function cuotaTimerWindow(dueDate: string): { from: string; to: string } {
  if (!YMD.test(dueDate)) return { from: dueDate, to: dueDate };
  const prevMonth = shiftMonth(dueDate.slice(0, 7), -1);
  const day = Number(dueDate.slice(8, 10));
  const [year, month] = prevMonth.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const clamped = Math.min(day, lastDay);
  const prevDue = `${prevMonth}-${String(clamped).padStart(2, "0")}`;
  return { from: shiftDate(prevDue, 1), to: dueDate };
}

export function cuotaTimersFetchRange(dueDates: string[]): { from: string; to: string } | null {
  let from = "";
  let to = "";
  for (const dueDate of dueDates) {
    if (!YMD.test(dueDate)) continue;
    const window = cuotaTimerWindow(dueDate);
    if (!from || window.from < from) from = window.from;
    if (!to || window.to > to) to = window.to;
  }
  if (!from || !to || from > to) return null;
  return { from, to };
}

export function formatCuotaTimerHours(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${formatHoursAsHm(safe / 3600)} hs`;
}

export function formatCuotaRepartidoHours(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  return `${formatHoursAsHm(safe / 3600)} rep`;
}

function addTimerShares(
  timer: Pick<ErpWorkTimer, "seconds" | "cuotaClient" | "cuotaClients" | "share">,
  key: string,
  totals: { focus: number; repartido: number },
) {
  if (timer.seconds <= 0) return;
  if (timer.share === "repartido" && timer.cuotaClients && timer.cuotaClients.length >= 2) {
    const part = repartidoSecondsForClient(timer.cuotaClients, timer.seconds, key);
    if (part > 0) totals.repartido += part;
    return;
  }
  if (timer.cuotaClient && clientKey(timer.cuotaClient) === key) {
    totals.focus += timer.seconds;
  }
}

export function secondsForCuotaClient(
  clientName: string,
  from: string,
  to: string,
  logs: ErpDayLog[],
  nowMs: number,
  today: string,
): { focus: number; repartido: number } {
  const key = clientKey(clientName);
  const totals = { focus: 0, repartido: 0 };
  if (!key || !YMD.test(from) || !YMD.test(to) || from > to) return totals;
  for (const log of logs) {
    if (log.date < from || log.date > to) continue;
    const timers = normalizeWorkTimers(log.workTimers);
    for (const category of Object.keys(timers) as WorkCategoryKey[]) {
      for (const timer of timers[category]) addTimerShares(timer, key, totals);
    }
  }
  if (today >= from && today <= to) {
    const todayLog = logs.find((log) => log.date === today);
    const active = normalizeActiveWorkTimer(todayLog?.activeWorkTimer ?? null);
    if (active) {
      addTimerShares(
        { ...active, seconds: elapsedActiveSeconds(active, nowMs) },
        key,
        totals,
      );
    }
  }
  return totals;
}

export function buildCuotaTimerRows(
  cuotas: CuotaTimerInput[],
  logs: ErpDayLog[],
  nowMs: number,
  today: string = todayYmd(),
): CuotaTimerRow[] {
  return [...cuotas]
    .sort(
      (a, b) =>
        a.dueDate.localeCompare(b.dueDate) || a.clientName.localeCompare(b.clientName, "es"),
    )
    .map((cuota) => {
      const window = cuotaTimerWindow(cuota.dueDate);
      const shares = secondsForCuotaClient(
        cuota.clientName,
        window.from,
        window.to,
        logs,
        nowMs,
        today,
      );
      return {
        ...cuota,
        seconds: shares.focus,
        repartidoSeconds: shares.repartido,
        hoursLabel: formatCuotaTimerHours(shares.focus),
        repartidoLabel: shares.repartido > 0 ? formatCuotaRepartidoHours(shares.repartido) : "",
      };
    });
}
