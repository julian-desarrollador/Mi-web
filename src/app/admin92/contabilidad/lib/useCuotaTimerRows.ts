"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCuotaTimerRows,
  cuotaTimersFetchRange,
  type CuotaTimerInput,
  type CuotaTimerRow,
} from "@/app/admin92/contabilidad/lib/cuotaTimers";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import type { ErpDayLog } from "@/app/admin92/erp/lib/erpTypes";

type Options = {
  /** Log de hoy en vivo (timer live): reemplaza al traído de la API para que el tramo en curso sume. */
  liveTodayLog?: ErpDayLog;
  /** Reloj del timer live; sin él se usa el momento de la carga. */
  nowMs?: number;
};

/**
 * Horas de cada cuota en su ventana (día siguiente al vencimiento anterior → vencimiento):
 * total, focus y compartido. Solo carga los logs mientras `enabled` está activo.
 */
export function useCuotaTimerRows(
  cuotas: CuotaTimerInput[],
  enabled: boolean,
  { liveTodayLog, nowMs }: Options = {},
): { rows: CuotaTimerRow[]; loading: boolean; error: string } {
  const [logs, setLogs] = useState<ErpDayLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadedAt, setLoadedAt] = useState(() => Date.now());

  const range = useMemo(() => cuotaTimersFetchRange(cuotas.map((c) => c.dueDate)), [cuotas]);
  const from = range?.from ?? "";
  const to = range?.to ?? "";

  useEffect(() => {
    if (!enabled || !from || !to) {
      setLogs([]);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch(`/api/admin/erp-logs?from=${from}&to=${to}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { logs?: ErpDayLog[]; error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudieron cargar las horas.");
        setLogs(data.logs ?? []);
        setLoadedAt(Date.now());
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setLogs([]);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las horas.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [enabled, from, to]);

  const rows = useMemo(() => {
    if (!enabled) return [];
    const today = todayYmd();
    const merged = liveTodayLog
      ? [...logs.filter((log) => log.date !== liveTodayLog.date), liveTodayLog]
      : logs;
    return buildCuotaTimerRows(cuotas, merged, nowMs ?? loadedAt, today);
  }, [enabled, cuotas, logs, liveTodayLog, nowMs, loadedAt]);

  return { rows, loading, error };
}
