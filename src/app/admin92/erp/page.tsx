"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutDashboard, PenLine } from "lucide-react";
import ErpDashboard from "@/app/admin92/erp/components/ErpDashboard";
import ErpDayForm from "@/app/admin92/erp/components/ErpDayForm";
import ErpLiveTimer from "@/app/admin92/erp/components/ErpLiveTimer";
import ErpNoFumar from "@/app/admin92/erp/components/ErpNoFumar";
import ErpObservations from "@/app/admin92/erp/components/ErpObservations";
import ErpPeriodPicker from "@/app/admin92/erp/components/ErpPeriodPicker";
import ErpReflection from "@/app/admin92/erp/components/ErpReflection";
import {
  buildKpis,
  buildWeekCompareRows,
  computePeriodStats,
  formatPeriodLabel,
  formatWeekRangeLabel,
  logsInDates,
  mondayOfWeek,
  periodDates,
  previousPeriodAnchor,
  shiftPeriodAnchor,
  weekDates,
  type ErpPeriod,
} from "@/app/admin92/erp/lib/erpAggregates";
import {
  emptyDayLog,
  emptyMembershipMonth,
  normalizeActiveWorkTimer,
  startActiveWorkTimerOnLog,
  stopActiveWorkTimerOnLog,
  type ErpDayLog,
  type ErpMembershipMonth,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";
import {
  getMonthKeySafe,
  shiftDate,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";

type ViewTab = "dashboard" | "cargar";

const PERIOD_OPTIONS: { key: ErpPeriod; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
];

export default function ErpPage() {
  const [view, setView] = useState<ViewTab>("dashboard");
  const [dayLogs, setDayLogs] = useState<ErpDayLog[]>([]);
  const [selectedDate, setSelectedDate] = useState(() => todayYmd());
  const [period, setPeriod] = useState<ErpPeriod>("week");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [timerSaving, setTimerSaving] = useState(false);
  const [workEditSaving, setWorkEditSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [membershipSaving, setMembershipSaving] = useState(false);
  const membershipSaveTimer = useRef<number | null>(null);
  const periodMonth = getMonthKeySafe(selectedDate);
  const [editMembershipMonth, setEditMembershipMonth] = useState(periodMonth);
  const [membershipsByMonth, setMembershipsByMonth] = useState<
    Record<string, ErpMembershipMonth>
  >(() => ({
    [periodMonth]: emptyMembershipMonth(periodMonth),
  }));

  const membershipMonthWindow = useMemo(() => {
    const months: string[] = [];
    for (let i = -2; i <= 3; i += 1) {
      months.push(shiftMonth(periodMonth, i));
    }
    return months;
  }, [periodMonth]);

  const membership =
    membershipsByMonth[editMembershipMonth] ??
    emptyMembershipMonth(editMembershipMonth);

  const [compareWeekA, setCompareWeekA] = useState(() => mondayOfWeek(todayYmd()));
  const [compareWeekB, setCompareWeekB] = useState(() =>
    shiftDate(mondayOfWeek(todayYmd()), -7),
  );

  const dates = useMemo(() => periodDates(selectedDate, period), [selectedDate, period]);
  const prevAnchor = useMemo(
    () => previousPeriodAnchor(selectedDate, period),
    [selectedDate, period],
  );
  const prevDates = useMemo(() => periodDates(prevAnchor, period), [prevAnchor, period]);

  const currentLogs = useMemo(() => logsInDates(dayLogs, dates), [dayLogs, dates]);
  const previousLogs = useMemo(() => logsInDates(dayLogs, prevDates), [dayLogs, prevDates]);

  const currentStats = useMemo(
    () => computePeriodStats(currentLogs, dates, period),
    [currentLogs, dates, period],
  );
  const previousStats = useMemo(() => {
    if (previousLogs.length === 0) return null;
    return computePeriodStats(previousLogs, prevDates, period);
  }, [previousLogs, prevDates, period]);

  const kpis = useMemo(
    () => buildKpis(currentStats, previousStats, period),
    [currentStats, previousStats, period],
  );

  const compareDatesA = useMemo(() => weekDates(compareWeekA), [compareWeekA]);
  const compareDatesB = useMemo(() => weekDates(compareWeekB), [compareWeekB]);
  const compareLogsA = useMemo(
    () => logsInDates(dayLogs, compareDatesA),
    [dayLogs, compareDatesA],
  );
  const compareLogsB = useMemo(
    () => logsInDates(dayLogs, compareDatesB),
    [dayLogs, compareDatesB],
  );
  const compareStatsA = useMemo(
    () => computePeriodStats(compareLogsA, compareDatesA, "week"),
    [compareLogsA, compareDatesA],
  );
  const compareStatsB = useMemo(
    () => computePeriodStats(compareLogsB, compareDatesB, "week"),
    [compareLogsB, compareDatesB],
  );
  const weekCompareRows = useMemo(
    () =>
      buildWeekCompareRows(
        compareStatsA,
        compareStatsB,
        compareLogsA.length > 0,
        compareLogsB.length > 0,
      ),
    [compareStatsA, compareStatsB, compareLogsA.length, compareLogsB.length],
  );

  useEffect(() => {
    if (period !== "week") return;
    const nextA = mondayOfWeek(selectedDate);
    setCompareWeekA(nextA);
    setCompareWeekB((prevB) => (prevB === nextA ? shiftDate(nextA, -7) : prevB));
  }, [selectedDate, period]);

  const focusLog = useMemo(() => {
    if (period === "day") return dayLogs.find((l) => l.date === selectedDate);
    const today = todayYmd();
    if (dates.includes(today)) return dayLogs.find((l) => l.date === today);
    return dayLogs.find((l) => l.date === selectedDate);
  }, [dayLogs, dates, period, selectedDate]);

  const rangeLabel = formatPeriodLabel(selectedDate, period);

  const requestedDates = useMemo(() => {
    if (view === "cargar") return weekDates(mondayOfWeek(selectedDate));
    const base = [...prevDates, ...dates];
    if (period === "week") {
      base.push(...compareDatesA, ...compareDatesB);
    }
    return Array.from(new Set(base)).sort();
  }, [compareDatesA, compareDatesB, dates, period, prevDates, selectedDate, view]);

  const requestFrom = requestedDates[0];
  const requestTo = requestedDates[requestedDates.length - 1];

  useEffect(() => {
    if (!requestFrom || !requestTo) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(null);

    void fetch(`/api/admin/erp-logs?from=${requestFrom}&to=${requestTo}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { logs?: ErpDayLog[]; error?: string };
        if (!response.ok) {
          throw new Error(data.error || "No se pudieron cargar los registros.");
        }
        const incoming = data.logs ?? [];
        setDayLogs((previous) => {
          const outsideRange = previous.filter(
            (log) => log.date < requestFrom || log.date > requestTo,
          );
          return [...outsideRange, ...incoming].sort((a, b) => a.date.localeCompare(b.date));
        });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setLoadError(
          error instanceof Error ? error.message : "No se pudieron cargar los registros.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [requestFrom, requestTo]);

  useEffect(() => {
    setEditMembershipMonth(periodMonth);
  }, [periodMonth]);

  useEffect(() => {
    const controller = new AbortController();
    const from = membershipMonthWindow[0];
    const to = membershipMonthWindow[membershipMonthWindow.length - 1];
    void fetch(`/api/admin/erp-memberships?from=${from}&to=${to}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as {
          memberships?: ErpMembershipMonth[];
          error?: string;
        };
        if (!response.ok || !data.memberships) {
          throw new Error(data.error || "No se pudieron cargar las cuotas.");
        }
        const next: Record<string, ErpMembershipMonth> = {};
        for (const month of membershipMonthWindow) {
          next[month] = emptyMembershipMonth(month);
        }
        for (const item of data.memberships) {
          next[item.month] = item;
        }
        setMembershipsByMonth(next);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        const next: Record<string, ErpMembershipMonth> = {};
        for (const month of membershipMonthWindow) {
          next[month] = emptyMembershipMonth(month);
        }
        setMembershipsByMonth(next);
      });

    return () => controller.abort();
  }, [membershipMonthWindow]);

  const handleMembershipChange = (next: ErpMembershipMonth) => {
    setMembershipsByMonth((prev) => ({ ...prev, [next.month]: next }));
    setMembershipSaving(true);
    if (membershipSaveTimer.current !== null) {
      window.clearTimeout(membershipSaveTimer.current);
    }
    membershipSaveTimer.current = window.setTimeout(() => {
      void fetch(`/api/admin/erp-memberships/${next.month}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
        .then(async (response) => {
          const data = (await response.json()) as {
            membership?: ErpMembershipMonth;
            error?: string;
          };
          if (!response.ok || !data.membership) {
            throw new Error(data.error || "No se pudieron guardar las cuotas.");
          }
          setMembershipsByMonth((prev) => ({
            ...prev,
            [data.membership!.month]: data.membership!,
          }));
        })
        .catch(() => {
          // Mantener el valor local si falla el guardado.
        })
        .finally(() => setMembershipSaving(false));
    }, 450);
  };

  const upsertLocalLog = (log: ErpDayLog) => {
    setDayLogs((prev) => {
      const idx = prev.findIndex((l) => l.date === log.date);
      if (idx === -1) return [...prev, log].sort((a, b) => a.date.localeCompare(b.date));
      const next = [...prev];
      next[idx] = log;
      return next;
    });
  };

  const handleSaveDay = async (log: ErpDayLog): Promise<ErpDayLog> => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/erp-logs/${log.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
      });
      const data = (await response.json()) as {
        log?: ErpDayLog;
        error?: string;
      };
      if (!response.ok || !data.log) {
        throw new Error(data.error || "No se pudo guardar el día.");
      }
      upsertLocalLog(data.log);
      return data.log;
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el día.";
      setSaveError(message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const today = todayYmd();
  const todayLog = useMemo(() => {
    return dayLogs.find((log) => log.date === today) ?? emptyDayLog(today);
  }, [dayLogs, today]);

  const workEditLog = useMemo(() => {
    if (period === "day") {
      return dayLogs.find((log) => log.date === selectedDate) ?? emptyDayLog(selectedDate);
    }
    if (dates.includes(today)) {
      return dayLogs.find((log) => log.date === today) ?? emptyDayLog(today);
    }
    const sorted = [...currentLogs].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted[0]) return sorted[0];
    return emptyDayLog(dates[dates.length - 1] ?? selectedDate);
  }, [period, selectedDate, dayLogs, dates, today, currentLogs]);

  const handlePersistWorkEditLog = async (log: ErpDayLog): Promise<void> => {
    setWorkEditSaving(true);
    try {
      const response = await fetch(`/api/admin/erp-logs/${log.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
      });
      const data = (await response.json()) as {
        log?: ErpDayLog;
        error?: string;
      };
      if (!response.ok || !data.log) {
        throw new Error(data.error || "No se pudo guardar el desglose.");
      }
      upsertLocalLog(data.log);
    } finally {
      setWorkEditSaving(false);
    }
  };

  const handlePersistLiveTimer = async (log: ErpDayLog): Promise<void> => {
    setTimerSaving(true);
    try {
      const response = await fetch(`/api/admin/erp-logs/${log.date}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(log),
      });
      const data = (await response.json()) as {
        log?: ErpDayLog;
        error?: string;
      };
      if (!response.ok || !data.log) {
        throw new Error(data.error || "No se pudo guardar el timer.");
      }
      upsertLocalLog(data.log);
    } finally {
      setTimerSaving(false);
    }
  };

  const handleStartLiveTimer = async (
    category: WorkCategoryKey,
    name: string,
  ): Promise<void> => {
    const active = normalizeActiveWorkTimer(todayLog.activeWorkTimer ?? null);
    const same =
      active &&
      active.category === category &&
      active.name.trim().toLowerCase() === name.trim().toLowerCase();
    const next = same
      ? stopActiveWorkTimerOnLog(todayLog)
      : startActiveWorkTimerOnLog(todayLog, category, name);
    await handlePersistLiveTimer(next);
  };

  const handleDeleteDay = async (date: string): Promise<void> => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch(`/api/admin/erp-logs/${date}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "No se pudo eliminar el día.");
      }
      setDayLogs((previous) => previous.filter((log) => log.date !== date));
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar el día.";
      setSaveError(message);
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const goPrev = () => setSelectedDate(shiftPeriodAnchor(selectedDate, period, -1));
  const goNext = () => setSelectedDate(shiftPeriodAnchor(selectedDate, period, 1));

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin92/contabilidad"
              aria-label="Volver a contabilidad"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <button
                type="button"
                onClick={() => setTitleExpanded((prev) => !prev)}
                aria-expanded={titleExpanded}
                className="group text-left cursor-pointer"
              >
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 transition group-hover:text-slate-700 sm:text-3xl">
                  {titleExpanded ? "Enterprise Resource Planning Personal" : "ERP Personal"}
                </h1>
                {titleExpanded ? (
                  <p className="mt-1 text-xs text-slate-500 sm:text-sm">
                    Planificación de Recursos Empresariales Personal.
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">Filtrá por día, semana o mes.</p>
                )}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <ErpNoFumar />
              <ErpObservations />
              <button
                type="button"
                onClick={() => setView("dashboard")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  view === "dashboard"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </button>
              <button
                type="button"
                onClick={() => setView("cargar")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition cursor-pointer ${
                  view === "cargar"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <PenLine className="h-4 w-4" />
                Cargar día
              </button>
            </div>
          </div>
        </header>

        {loadError && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {loadError}
          </div>
        )}

        <div className="mb-6">
          <ErpLiveTimer
            todayLog={todayLog}
            dayLogs={dayLogs}
            onPersist={handlePersistLiveTimer}
            persisting={timerSaving}
          />
        </div>

        {view === "dashboard" ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                {PERIOD_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPeriod(opt.key)}
                    className={`rounded-lg px-3.5 py-2 text-sm font-medium transition cursor-pointer ${
                      period === opt.key
                        ? "bg-blue-600 text-white"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 shadow-sm">
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Período anterior"
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <ErpPeriodPicker
                  period={period}
                  value={selectedDate}
                  rangeLabel={rangeLabel}
                  onChange={setSelectedDate}
                  logsDates={dayLogs.map((log) => log.date)}
                />

                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Período siguiente"
                  className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ErpReflection />

            <ErpDashboard
              period={period}
              rangeLabel={rangeLabel}
              current={currentStats}
              previous={previousStats}
              kpis={kpis}
              focusLog={focusLog}
              periodLogs={currentLogs}
              workEditLog={workEditLog}
              onPersistWorkEditLog={handlePersistWorkEditLog}
              workEditSaving={workEditSaving}
              activeWorkTimer={todayLog.activeWorkTimer ?? null}
              countsLiveTimer={dates.includes(today)}
              onStartLiveTimer={handleStartLiveTimer}
              timerSaving={timerSaving}
              loading={loading}
              hasData={currentLogs.length > 0}
              membershipMonth={editMembershipMonth}
              membershipMonths={membershipMonthWindow}
              membershipsByMonth={membershipsByMonth}
              membership={membership}
              membershipSaving={membershipSaving}
              onMembershipMonthChange={setEditMembershipMonth}
              onMembershipChange={handleMembershipChange}
              weekCompare={{
                weekA: compareWeekA,
                weekB: compareWeekB,
                labelA: formatWeekRangeLabel(compareWeekA),
                labelB: formatWeekRangeLabel(compareWeekB),
                rows: weekCompareRows,
                onShiftA: (delta) => {
                  setCompareWeekA((prev) => {
                    let next = shiftDate(prev, delta * 7);
                    if (next === compareWeekB) next = shiftDate(next, delta * 7);
                    return next;
                  });
                },
                onShiftB: (delta) => {
                  setCompareWeekB((prev) => {
                    let next = shiftDate(prev, delta * 7);
                    if (next === compareWeekA) next = shiftDate(next, delta * 7);
                    return next;
                  });
                },
              }}
            />
          </>
        ) : (
          <ErpDayForm
            selectedDate={selectedDate}
            onSelectedDateChange={setSelectedDate}
            dayLogs={dayLogs}
            onSave={handleSaveDay}
            onDelete={handleDeleteDay}
            onClose={() => setView("dashboard")}
            loading={loading}
            saving={saving}
            saveError={saveError}
          />
        )}
      </div>
    </main>
  );
}
