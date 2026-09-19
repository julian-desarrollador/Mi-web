"use client";

import { useMemo, type ComponentType } from "react";
import {
  formatHoursAsHm,
  normalizeWork,
  normalizeWorkTimers,
  sumWorkHours,
  WORK_CATEGORY_META,
  type ErpActiveWorkTimer,
  type ErpDayLog,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import { formatLocalDate } from "@/app/admin92/contabilidad/lib/utils";
import WorkCategoriesEditor from "@/app/admin92/erp/components/WorkCategoriesEditor";

type Props = {
  logs: ErpDayLog[];
  icons: Record<WorkCategoryKey, ComponentType<{ className?: string }>>;
  onPersist: (log: ErpDayLog) => Promise<void>;
  persisting?: boolean;
  activeWorkTimer?: ErpActiveWorkTimer | null;
  onStartLiveTimer?: (category: WorkCategoryKey, name: string) => Promise<void>;
  timerSaving?: boolean;
};

function dayHasWork(log: ErpDayLog): boolean {
  const work = normalizeWork(log.work);
  if (sumWorkHours(work) > 0) return true;
  const timers = normalizeWorkTimers(log.workTimers);
  return WORK_CATEGORY_META.some((c) => (timers[c.key] ?? []).length > 0);
}

export default function WorkCategoriesHistory({
  logs,
  icons,
  onPersist,
  persisting = false,
  activeWorkTimer = null,
  onStartLiveTimer,
  timerSaving = false,
}: Props) {
  const days = useMemo(() => {
    return [...logs]
      .filter(dayHasWork)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((log) => ({
        log,
        total: sumWorkHours(normalizeWork(log.work)),
      }));
  }, [logs]);

  if (days.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-medium text-slate-400">
        Sin historial de trabajo en este período
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs font-medium text-slate-500">
        Más reciente primero · click en un timer para editar · Play inicia el timer
        de hoy
        {persisting ? " · Guardando…" : ""}
      </p>

      {days.map(({ log, total }) => (
        <div key={log.date} className="space-y-3">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2">
            <p className="text-sm font-bold text-slate-950">
              {formatLocalDate(log.date)}
            </p>
            <span className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {formatHoursAsHm(total)} hs
            </span>
          </div>

          <WorkCategoriesEditor
            editLog={log}
            onPersist={onPersist}
            persisting={persisting}
            hideEmptyCategories
            timerOrder="newest"
            subtitle=""
            icons={icons}
            activeWorkTimer={activeWorkTimer}
            onStartLiveTimer={onStartLiveTimer}
            timerSaving={timerSaving}
          />
        </div>
      ))}
    </div>
  );
}
