import {
  formatMonthLabel,
  getMonthKeySafe,
  shiftDate,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";
import {
  formatHoursAsHm,
  formatMinutesAsHm,
  isTrainingDone,
  countMealsDone,
  avgMealQuality,
  emptyFood,
  EMPTY_WORK,
  minutesBetweenTimes,
  normalizeWork,
  normalizeWorkTimers,
  emptyWorkTimers,
  sumWorkHours,
  effectiveTrainingMinutes,
  effectiveEnglishMinutes,
  WORK_CATEGORY_META,
  TRAINING_CATEGORY_META,
  type ErpDayLog,
  type ErpWorkHours,
  type ErpWorkTimer,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";

const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] as const;

export type ErpPeriod = "day" | "week" | "month";

export function mondayOfWeek(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return shiftDate(ymd, mondayOffset);
}

export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => shiftDate(monday, i));
}

export function monthDates(ymd: string): string[] {
  const [y, m] = ymd.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const prefix = `${y}-${String(m).padStart(2, "0")}`;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `${prefix}-${day}`;
  });
}

export function periodDates(anchor: string, period: ErpPeriod): string[] {
  if (period === "day") return [anchor];
  if (period === "week") return weekDates(mondayOfWeek(anchor));
  return monthDates(anchor);
}

/** Ancla del período anterior comparable (mismo size relativo). */
export function previousPeriodAnchor(anchor: string, period: ErpPeriod): string {
  if (period === "day") return shiftDate(anchor, -1);
  if (period === "week") return shiftDate(mondayOfWeek(anchor), -7);
  const prevYm = shiftMonth(getMonthKeySafe(anchor), -1);
  return `${prevYm}-01`;
}

export function shiftPeriodAnchor(anchor: string, period: ErpPeriod, delta: number): string {
  if (period === "day") return shiftDate(anchor, delta);
  if (period === "week") return shiftDate(mondayOfWeek(anchor), delta * 7);
  const nextYm = shiftMonth(getMonthKeySafe(anchor), delta);
  return `${nextYm}-01`;
}

export function formatWeekRangeLabel(monday: string): string {
  const sunday = shiftDate(monday, 6);
  const fmt = (ymd: string) => {
    const [, m, d] = ymd.split("-");
    return `${Number(d)}/${Number(m)}`;
  };
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

export function formatPeriodLabel(anchor: string, period: ErpPeriod): string {
  if (period === "day") {
    const [, m, d] = anchor.split("-").map(Number);
    return `${dayShortLabel(anchor)} ${d}/${m}`;
  }
  if (period === "week") return formatWeekRangeLabel(mondayOfWeek(anchor));
  return formatMonthLabel(getMonthKeySafe(anchor));
}

export function periodCompareLabel(period: ErpPeriod): string {
  if (period === "day") return "vs. día anterior";
  if (period === "week") return "vs. semana anterior";
  return "vs. mes anterior";
}

export function periodTitle(period: ErpPeriod): string {
  if (period === "day") return "Resumen del día";
  if (period === "week") return "Resumen de la semana";
  return "Resumen del mes";
}

export function dayShortLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return DAY_SHORT[new Date(y, m - 1, d).getDay()];
}

function chartDayLabel(ymd: string, period: ErpPeriod): string {
  if (period === "month") {
    const day = Number(ymd.split("-")[2]);
    return String(day);
  }
  if (period === "day") {
    const [, m, d] = ymd.split("-");
    return `${Number(d)}/${Number(m)}`;
  }
  return dayShortLabel(ymd);
}

export function logsByDateMap(logs: ErpDayLog[]): Map<string, ErpDayLog> {
  const map = new Map<string, ErpDayLog>();
  for (const log of logs) map.set(log.date, log);
  return map;
}

export function logsInWeek(logs: ErpDayLog[], monday: string): ErpDayLog[] {
  const dates = new Set(weekDates(monday));
  return logs.filter((l) => dates.has(l.date));
}

export function logsInDates(logs: ErpDayLog[], dates: string[]): ErpDayLog[] {
  const set = new Set(dates);
  return logs.filter((l) => set.has(l.date));
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

function periodGoals(period: ErpPeriod, dayCount: number) {
  if (period === "day") return { workGoal: 8, trainingGoal: 1 };
  if (period === "week") return { workGoal: 40, trainingGoal: 5 };
  // ~5.7 hs/día de trabajo · ~20 días entrenando al mes
  const workGoal = Math.round(40 * (dayCount / 7));
  const trainingGoal = Math.max(1, Math.round(5 * (dayCount / 7)));
  return { workGoal, trainingGoal };
}

export type PeriodStats = {
  workHours: number;
  dailyAvg: number;
  /** Promedio diario sin contar hoy. null si hoy no está en el período. */
  dailyAvgExcludingToday: number | null;
  /** Horas totales / 5 (lun–vie). Solo en vista semana. */
  dailyAvgWeekdays: number | null;
  trainingDays: number;
  /** Minutos totales de entrenamiento físico registrados */
  trainingMinutes: number;
  englishDays: number;
  englishMinutes: number;
  readingDays: number;
  readingPages: number;
  pianoDays: number;
  pianoMinutes: number;
  creatineDays: number;
  /** null si ningún día del período registró sueño */
  sleepAvg: number | null;
  /** Promedio de comidas hechas por día (0–4); null si no hay logs */
  foodMealsAvg: number | null;
  /** Promedio de calidad (1–5) entre comidas calificadas; null si no hay */
  foodQualityAvg: number | null;
  /**
   * Promedio de hora de inicio de trabajo (minutos desde 00:00).
   * null si ningún día del período cargó startedWorkAt.
   */
  startedWorkAvgMinutes: number | null;
  workByCategory: Record<WorkCategoryKey, number>;
  /** Timers mergeados por nombre dentro de cada categoría (período completo) */
  workTimersByCategory: Record<WorkCategoryKey, ErpWorkTimer[]>;
  trainingByCategory: Record<"gimnasio" | "natacion" | "casa", number>;
  trainingMinutesByCategory: Record<"gimnasio" | "natacion" | "casa", number>;
  workByDay: Array<ErpWorkHours & { day: string; date: string }>;
  distribution: Array<{ name: string; value: number; color: string; hours: number }>;
  goals: Array<{
    label: string;
    current: string;
    progress: number;
    color: string;
    track: string;
  }>;
  score: number;
  topWorkFocus: { name: string; pct: number } | null;
};

/** @deprecated usar PeriodStats */
export type WeekStats = PeriodStats;

export function computePeriodStats(
  periodLogs: ErpDayLog[],
  dates: string[],
  period: ErpPeriod,
): PeriodStats {
  const byDate = logsByDateMap(periodLogs);
  const { workGoal, trainingGoal } = periodGoals(period, dates.length);

  const workByCategory: Record<WorkCategoryKey, number> = { ...EMPTY_WORK };
  const workTimerSecondsByName: Record<WorkCategoryKey, Map<string, number>> = {
    software: new Map(),
    saas: new Map(),
    planificacion: new Map(),
    branding: new Map(),
    itNews: new Map(),
    stremear: new Map(),
  };
  const workTimerItemsByName: Record<
    WorkCategoryKey,
    Map<string, NonNullable<ErpWorkTimer["items"]>>
  > = {
    software: new Map(),
    saas: new Map(),
    planificacion: new Map(),
    branding: new Map(),
    itNews: new Map(),
    stremear: new Map(),
  };
  const trainingByCategory = { gimnasio: 0, natacion: 0, casa: 0 };
  const trainingMinutesByCategory = { gimnasio: 0, natacion: 0, casa: 0 };

  let workHours = 0;
  let trainingDays = 0;
  let trainingMinutes = 0;
  let englishDays = 0;
  let englishMinutes = 0;
  let readingDays = 0;
  let readingPages = 0;
  let pianoDays = 0;
  let pianoMinutes = 0;
  let creatineDays = 0;
  const sleepVals: number[] = [];
  const mealCountVals: number[] = [];
  const qualityDayVals: number[] = [];
  const startedWorkVals: number[] = [];

  const workByDay = dates.map((date) => {
    const log = byDate.get(date);
    const work = normalizeWork(log?.work);
    workHours += sumWorkHours(work);
    for (const key of Object.keys(workByCategory) as WorkCategoryKey[]) {
      workByCategory[key] += work[key];
    }

    if (log) {
      const dayTimers = normalizeWorkTimers(log.workTimers ?? emptyWorkTimers());
      for (const key of Object.keys(workTimerSecondsByName) as WorkCategoryKey[]) {
        for (const timer of dayTimers[key]) {
          const map = workTimerSecondsByName[key];
          map.set(timer.name, (map.get(timer.name) ?? 0) + timer.seconds);
          if (timer.items && timer.items.length > 0) {
            const itemsMap = workTimerItemsByName[key];
            const prev = itemsMap.get(timer.name) ?? [];
            const byId = new Map(prev.map((i) => [i.id, i]));
            for (const item of timer.items) byId.set(item.id, item);
            itemsMap.set(timer.name, [...byId.values()]);
          }
        }
      }
      if (log.sleepHours !== null && log.sleepHours !== undefined) {
        sleepVals.push(log.sleepHours);
      }
      const food = log.food ?? emptyFood();
      mealCountVals.push(countMealsDone(food));
      const dayQuality = avgMealQuality(food);
      if (dayQuality !== null) qualityDayVals.push(dayQuality);
      const startMins = clockTimeToMinutes(log.alarm?.startedWorkAt);
      if (startMins !== null) startedWorkVals.push(startMins);
      const trained =
        isTrainingDone(log.training.gimnasio) ||
        isTrainingDone(log.training.natacion) ||
        isTrainingDone(log.training.casa);
      if (trained) trainingDays += 1;

      (["gimnasio", "natacion", "casa"] as const).forEach((key) => {
        const session = log.training[key];
        if (!isTrainingDone(session)) return;
        trainingByCategory[key] += 1;
        const mins = effectiveTrainingMinutes(key, session);
        if (mins > 0) {
          trainingMinutesByCategory[key] += mins;
          trainingMinutes += mins;
        }
      });

      if (isTrainingDone(log.english)) {
        englishDays += 1;
        englishMinutes += effectiveEnglishMinutes(log.english);
      }
      if (log.reading?.done) {
        readingDays += 1;
        readingPages += log.reading.pages ?? 0;
      }
      if (isTrainingDone(log.piano)) {
        pianoDays += 1;
        pianoMinutes += log.piano.minutes ?? 0;
      }
      if (log.creatine) creatineDays += 1;
    }

    return { day: chartDayLabel(date, period), date, ...work };
  });

  // Días con log, incluido 0 hs. Hoy con 0 hs no cuenta: el día aún está en curso.
  const today = todayYmd();
  const daysForAvg = periodLogs.filter((log) => {
    if (log.date === today && sumWorkHours(log.work) === 0) return false;
    return true;
  }).length;
  const dailyAvg = workHours / Math.max(daysForAvg || 1, 1);

  const todayInPeriod = dates.includes(today);
  const todayHours = todayInPeriod
    ? sumWorkHours(normalizeWork(byDate.get(today)?.work))
    : 0;
  const daysExcludingToday = periodLogs.filter((log) => log.date !== today).length;
  const dailyAvgExcludingToday = todayInPeriod
    ? (workHours - todayHours) / Math.max(daysExcludingToday || 1, 1)
    : null;
  const dailyAvgWeekdays = period === "week" ? workHours / 5 : null;

  const trainingHours =
    trainingMinutes > 0 ? trainingMinutes / 60 : trainingDays * 1.25;
  const restPool = Math.max(workHours + trainingHours, 1);
  const descansoHours = Math.max(restPool * 0.3, 0);
  const totalPie = workHours + trainingHours + descansoHours;
  const pieSlice = (hours: number) =>
    totalPie > 0 ? Math.round((hours / totalPie) * 100) : 0;

  const distribution = [
    { name: "Trabajo", hours: workHours, value: pieSlice(workHours), color: "#2563eb" },
    {
      name: "Entrenamiento",
      hours: trainingHours,
      value: pieSlice(trainingHours),
      color: "#8b5cf6",
    },
    {
      name: "Descanso",
      hours: descansoHours,
      value: pieSlice(descansoHours),
      color: "#10b981",
    },
  ];
  const pieSum = distribution.reduce((s, d) => s + d.value, 0);
  if (pieSum !== 100 && distribution[0]) {
    distribution[0].value += 100 - pieSum;
  }

  const workProgress = Math.min(100, Math.round((workHours / workGoal) * 100));
  const trainingProgress = Math.min(100, Math.round((trainingDays / trainingGoal) * 100));

  const trainingGoalCurrent =
    trainingMinutes > 0
      ? `${trainingDays} / ${trainingGoal} ${trainingGoal === 1 ? "día" : "días"} · ${formatMinutesAsHm(trainingMinutes)}`
      : `${trainingDays} / ${trainingGoal} ${trainingGoal === 1 ? "día" : "días"}`;

  const goals = [
    {
      label: "Trabajo",
      current: `${formatHoursAsHm(workHours)} / ${workGoal} hs`,
      progress: workProgress,
      color: "bg-blue-500",
      track: "bg-blue-100",
    },
    {
      label: "Entrenamiento",
      current: trainingGoalCurrent,
      progress: trainingProgress,
      color: "bg-violet-500",
      track: "bg-violet-100",
    },
  ];

  const sleepAvg = sleepVals.length > 0 ? avg(sleepVals) : null;
  const foodMealsAvg = mealCountVals.length > 0 ? avg(mealCountVals) : null;
  const foodQualityAvg = qualityDayVals.length > 0 ? avg(qualityDayVals) : null;
  const startedWorkAvgMinutes =
    startedWorkVals.length > 0 ? avg(startedWorkVals) : null;

  const sleepScore =
    sleepAvg !== null ? Math.min(100, (sleepAvg / 8) * 100) : workProgress;
  const foodCompletion =
    foodMealsAvg !== null ? (foodMealsAvg / 4) * 100 : workProgress;
  const foodQualityPart =
    foodQualityAvg !== null ? (foodQualityAvg / 5) * 100 : foodCompletion;
  const foodScorePart = foodCompletion * 0.7 + foodQualityPart * 0.3;

  const score = Math.round(
    workProgress * 0.45 +
      trainingProgress * 0.3 +
      sleepScore * 0.15 +
      foodScorePart * 0.1,
  );

  let topWorkFocus: PeriodStats["topWorkFocus"] = null;
  if (workHours > 0) {
    const top = WORK_CATEGORY_META.map((c) => ({
      name: c.name,
      hours: workByCategory[c.key],
    })).sort((a, b) => b.hours - a.hours)[0];
    if (top && top.hours > 0) {
      topWorkFocus = {
        name: top.name.toLowerCase(),
        pct: Math.round((top.hours / workHours) * 100),
      };
    }
  }

  const workTimersByCategory = emptyWorkTimers();
  for (const key of Object.keys(workTimerSecondsByName) as WorkCategoryKey[]) {
    workTimersByCategory[key] = [...workTimerSecondsByName[key].entries()]
      .map(([name, seconds]) => {
        const items = workTimerItemsByName[key].get(name);
        return {
          name,
          seconds,
          ...(items && items.length > 0 ? { items } : {}),
        };
      })
      .sort((a, b) => b.seconds - a.seconds);
  }

  return {
    workHours,
    dailyAvg,
    dailyAvgExcludingToday,
    dailyAvgWeekdays,
    trainingDays,
    trainingMinutes,
    englishDays,
    englishMinutes,
    readingDays,
    readingPages,
    pianoDays,
    pianoMinutes,
    creatineDays,
    sleepAvg,
    foodMealsAvg,
    foodQualityAvg,
    startedWorkAvgMinutes,
    workByCategory,
    workTimersByCategory,
    trainingByCategory,
    trainingMinutesByCategory,
    workByDay,
    distribution,
    goals,
    score: Math.min(100, Math.max(0, score)),
    topWorkFocus,
  };
}

export function computeWeekStats(weekLogs: ErpDayLog[], monday: string): PeriodStats {
  return computePeriodStats(weekLogs, weekDates(monday), "week");
}

export function formatHours(n: number): string {
  return Number(n.toFixed(1)).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
}

export type KpiView = {
  label: string;
  value: string;
  unit: string;
  change: number | null;
  color: "blue" | "cyan" | "violet" | "emerald" | "indigo" | "amber" | "rose";
  kind: "work" | "daily" | "training" | "english" | "reading" | "piano" | "creatine" | "sleep" | "food";
  /** Líneas secundarias compactas (ej. sin hoy, lun–vie) */
  details?: string[];
};

export function buildKpis(
  current: PeriodStats,
  previous: PeriodStats | null,
  period: ErpPeriod = "week",
): KpiView[] {
  const sleepChange =
    current.sleepAvg !== null && previous?.sleepAvg != null
      ? pctChange(current.sleepAvg, previous.sleepAvg)
      : null;
  const foodChange =
    current.foodMealsAvg !== null && previous?.foodMealsAvg != null
      ? pctChange(current.foodMealsAvg, previous.foodMealsAvg)
      : null;

  const dailyKpi =
    period === "day"
      ? {
          label: "Foco principal",
          value: current.topWorkFocus?.name ?? "—",
          unit: current.topWorkFocus ? `${current.topWorkFocus.pct}%` : "",
          change: null as number | null,
          color: "cyan" as const,
          kind: "daily" as const,
        }
      : {
          label: "Promedio diario",
          value: formatHoursAsHm(current.dailyAvg),
          unit: "hs",
          change: previous ? pctChange(current.dailyAvg, previous.dailyAvg) : null,
          color: "cyan" as const,
          kind: "daily" as const,
          details: [
            ...(current.dailyAvgExcludingToday !== null
              ? [`sin hoy · ${formatHoursAsHm(current.dailyAvgExcludingToday)} hs`]
              : []),
            ...(current.dailyAvgWeekdays !== null
              ? [`lun–vie · ${formatHoursAsHm(current.dailyAvgWeekdays)} hs`]
              : []),
          ],
        };

  return [
    {
      label: "Horas trabajadas",
      value: formatHoursAsHm(current.workHours),
      unit: "hs",
      change: previous ? pctChange(current.workHours, previous.workHours) : null,
      color: "blue" as const,
      kind: "work" as const,
    },
    dailyKpi,
    {
      label: period === "day" ? "Entrenamiento" : "Días de entrenamiento",
      value:
        period === "day"
          ? current.trainingDays > 0
            ? current.trainingMinutes > 0
              ? formatMinutesAsHm(current.trainingMinutes)
              : "Sí"
            : "No"
          : String(current.trainingDays),
      unit:
        period === "day"
          ? current.trainingDays > 0 && current.trainingMinutes > 0
            ? "hs"
            : ""
          : current.trainingMinutes > 0
            ? `días · ${formatMinutesAsHm(current.trainingMinutes)}`
            : "días",
      change: previous ? pctChange(current.trainingDays, previous.trainingDays) : null,
      color: "violet",
      kind: "training",
    },
    {
      label: "Inglés",
      value:
        period === "day"
          ? current.englishDays > 0
            ? "Sí"
            : "No"
          : String(current.englishDays),
      unit:
        period === "day"
          ? current.englishMinutes > 0
            ? `${current.englishMinutes} min`
            : ""
          : current.englishMinutes > 0
            ? `días · ${current.englishMinutes} min`
            : "días",
      change: previous ? pctChange(current.englishDays, previous.englishDays) : null,
      color: "emerald",
      kind: "english",
    },
    {
      label: "Lectura",
      value:
        period === "day"
          ? current.readingDays > 0
            ? "Sí"
            : "No"
          : String(current.readingDays),
      unit:
        period === "day"
          ? current.readingPages > 0
            ? `${current.readingPages} pág`
            : ""
          : current.readingPages > 0
            ? `días · ${current.readingPages} pág`
            : "días",
      change: previous ? pctChange(current.readingDays, previous.readingDays) : null,
      color: "rose",
      kind: "reading",
    },
    {
      label: "Piano",
      value:
        period === "day"
          ? current.pianoDays > 0
            ? "Sí"
            : "No"
          : String(current.pianoDays),
      unit:
        period === "day"
          ? current.pianoMinutes > 0
            ? `${current.pianoMinutes} min`
            : ""
          : current.pianoMinutes > 0
            ? `días · ${current.pianoMinutes} min`
            : "días",
      change: previous ? pctChange(current.pianoDays, previous.pianoDays) : null,
      color: "violet",
      kind: "piano",
    },
    {
      label: "Creatina",
      value:
        period === "day"
          ? current.creatineDays > 0
            ? "Sí"
            : "No"
          : String(current.creatineDays),
      unit: period === "day" ? "" : "días",
      change: previous ? pctChange(current.creatineDays, previous.creatineDays) : null,
      color: "cyan",
      kind: "creatine",
    },
    {
      label: period === "day" ? "Sueño" : "Promedio sueño",
      value: current.sleepAvg !== null ? formatHours(current.sleepAvg) : "—",
      unit: current.sleepAvg !== null ? "hs" : "",
      change: sleepChange,
      color: "indigo",
      kind: "sleep",
    },
    {
      label: period === "day" ? "Alimentación" : "Comidas / día",
      value:
        current.foodMealsAvg !== null
          ? period === "day"
            ? `${Math.round(current.foodMealsAvg)}/4`
            : formatHours(current.foodMealsAvg)
          : "—",
      unit:
        current.foodMealsAvg === null
          ? ""
          : current.foodQualityAvg !== null
            ? `cal. ${formatHours(current.foodQualityAvg)}`
            : period === "day"
              ? "comidas"
              : "prom.",
      change: foodChange,
      color: "amber",
      kind: "food",
    },
  ];
}

export function overallChangePct(
  current: PeriodStats,
  previous: PeriodStats | null,
): number | null {
  if (!previous) return null;
  return pctChange(current.score, previous.score);
}

export type WeekCompareRow = {
  key: string;
  label: string;
  valueA: string;
  valueB: string;
  /** Texto de diferencia (absoluto + %); null si no aplica */
  diffLabel: string | null;
  /** true = A mejor que B; null = neutro / sin dato */
  improved: boolean | null;
};

function formatSignedHours(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${formatHoursAsHm(Math.abs(delta))}`;
}

function formatSignedNumber(delta: number, digits = 1): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const abs = Math.abs(delta);
  const text =
    digits === 0
      ? String(Math.round(abs))
      : Number(abs.toFixed(digits)).toLocaleString("es-AR", {
          minimumFractionDigits: 0,
          maximumFractionDigits: digits,
        });
  return `${sign}${text}`;
}

/** HH:MM → minutos desde medianoche; null si inválido */
function clockTimeToMinutes(hhmm: string | null | undefined): number | null {
  if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
  const [h, m] = hhmm.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || m < 0 || m > 59) return null;
  return h * 60 + m;
}

/** Minutos desde medianoche → HH:MM */
function minutesToClockTime(mins: number): string {
  const rounded = Math.round(mins);
  const normalized = ((rounded % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatStartedWorkAvg(stats: PeriodStats): string {
  if (stats.startedWorkAvgMinutes === null) return "—";
  return minutesToClockTime(stats.startedWorkAvgMinutes);
}

/** Diff de hora de inicio: +15 min / −20 min */
function formatSignedClockMinutes(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  const abs = Math.round(Math.abs(delta));
  return `${sign}${abs} min`;
}

/** Diff = B − A (cambio de la semana A hacia la B). */
function weekMetricDiff(
  a: number | null,
  b: number | null,
  formatAbs: (delta: number) => string,
  opts?: { lowerIsBetter?: boolean },
): Pick<WeekCompareRow, "diffLabel" | "improved"> {
  if (a === null || b === null) return { diffLabel: null, improved: null };
  const delta = b - a;
  const pct = pctChange(b, a);
  const absPart = formatAbs(delta);
  const pctPart = pct === null ? "" : ` (${pct > 0 ? "+" : ""}${pct}%)`;
  const better =
    delta === 0
      ? null
      : opts?.lowerIsBetter
        ? delta < 0
        : delta > 0;
  return {
    diffLabel: `${absPart}${pctPart}`,
    improved: better,
  };
}

function formatTrainingWeek(stats: PeriodStats): string {
  if (stats.trainingMinutes > 0) {
    return `${stats.trainingDays} d · ${formatMinutesAsHm(stats.trainingMinutes)}`;
  }
  return `${stats.trainingDays} d`;
}

function formatReadingWeek(stats: PeriodStats): string {
  if (stats.readingPages > 0) return `${stats.readingDays} d · ${stats.readingPages} pág`;
  return `${stats.readingDays} d`;
}

function formatPianoWeek(stats: PeriodStats): string {
  if (stats.pianoMinutes > 0) return `${stats.pianoDays} d · ${stats.pianoMinutes} min`;
  return `${stats.pianoDays} d`;
}

function formatEnglishWeek(stats: PeriodStats): string {
  if (stats.englishMinutes > 0) {
    return `${stats.englishDays} d · ${stats.englishMinutes} min`;
  }
  return `${stats.englishDays} d`;
}

function formatFoodWeek(stats: PeriodStats): string {
  if (stats.foodMealsAvg === null) return "—";
  const meals = formatHours(stats.foodMealsAvg);
  if (stats.foodQualityAvg !== null) {
    return `${meals} · cal. ${formatHours(stats.foodQualityAvg)}`;
  }
  return meals;
}

/** Filas para comparar dos semanas (A vs B). */
export function buildWeekCompareRows(
  statsA: PeriodStats | null,
  statsB: PeriodStats | null,
  hasDataA: boolean,
  hasDataB: boolean,
): WeekCompareRow[] {
  const empty = "Sin datos";
  const val = (has: boolean, text: string) => (has ? text : empty);

  const a = statsA;
  const b = statsB;

  const row = (
    key: string,
    label: string,
    textA: string,
    textB: string,
    numA: number | null,
    numB: number | null,
    formatAbs: (delta: number) => string,
    opts?: { lowerIsBetter?: boolean; includePct?: boolean },
  ): WeekCompareRow => {
    const valueA = val(hasDataA, textA);
    const valueB = val(hasDataB, textB);
    if (!hasDataA || !hasDataB) {
      return { key, label, valueA, valueB, diffLabel: null, improved: null };
    }
    const { diffLabel, improved } = weekMetricDiff(numA, numB, formatAbs, opts);
    // Para hora de inicio el % no aporta; quitarlo si includePct === false
    if (opts?.includePct === false && diffLabel) {
      const withoutPct = diffLabel.replace(/\s*\([^)]*%\)\s*$/, "");
      return { key, label, valueA, valueB, diffLabel: withoutPct, improved };
    }
    return { key, label, valueA, valueB, diffLabel, improved };
  };

  return [
    row(
      "work",
      "Horas trabajadas",
      a ? `${formatHoursAsHm(a.workHours)} hs` : "—",
      b ? `${formatHoursAsHm(b.workHours)} hs` : "—",
      a?.workHours ?? null,
      b?.workHours ?? null,
      formatSignedHours,
    ),
    row(
      "daily",
      "Promedio diario",
      a ? `${formatHoursAsHm(a.dailyAvg)} hs` : "—",
      b ? `${formatHoursAsHm(b.dailyAvg)} hs` : "—",
      a?.dailyAvg ?? null,
      b?.dailyAvg ?? null,
      formatSignedHours,
    ),
    row(
      "startedWork",
      "Inicio de trabajo",
      a ? formatStartedWorkAvg(a) : "—",
      b ? formatStartedWorkAvg(b) : "—",
      a?.startedWorkAvgMinutes ?? null,
      b?.startedWorkAvgMinutes ?? null,
      formatSignedClockMinutes,
      { lowerIsBetter: true, includePct: false },
    ),
    row(
      "training",
      "Entrenamiento",
      a ? formatTrainingWeek(a) : "—",
      b ? formatTrainingWeek(b) : "—",
      a?.trainingDays ?? null,
      b?.trainingDays ?? null,
      (d) => formatSignedNumber(d, 0),
    ),
    row(
      "english",
      "Inglés",
      a ? formatEnglishWeek(a) : "—",
      b ? formatEnglishWeek(b) : "—",
      a?.englishDays ?? null,
      b?.englishDays ?? null,
      (d) => formatSignedNumber(d, 0),
    ),
    row(
      "reading",
      "Lectura",
      a ? formatReadingWeek(a) : "—",
      b ? formatReadingWeek(b) : "—",
      a?.readingDays ?? null,
      b?.readingDays ?? null,
      (d) => formatSignedNumber(d, 0),
    ),
    row(
      "piano",
      "Piano",
      a ? formatPianoWeek(a) : "—",
      b ? formatPianoWeek(b) : "—",
      a?.pianoDays ?? null,
      b?.pianoDays ?? null,
      (d) => formatSignedNumber(d, 0),
    ),
    row(
      "creatine",
      "Creatina",
      a ? `${a.creatineDays} d` : "—",
      b ? `${b.creatineDays} d` : "—",
      a?.creatineDays ?? null,
      b?.creatineDays ?? null,
      (d) => formatSignedNumber(d, 0),
    ),
    row(
      "sleep",
      "Sueño promedio",
      a && a.sleepAvg !== null ? `${formatHours(a.sleepAvg)} hs` : "—",
      b && b.sleepAvg !== null ? `${formatHours(b.sleepAvg)} hs` : "—",
      a?.sleepAvg ?? null,
      b?.sleepAvg ?? null,
      (d) => `${formatSignedNumber(d, 1)} hs`,
    ),
    row(
      "food",
      "Alimentación",
      a ? formatFoodWeek(a) : "—",
      b ? formatFoodWeek(b) : "—",
      a?.foodMealsAvg ?? null,
      b?.foodMealsAvg ?? null,
      (d) => formatSignedNumber(d, 1),
    ),
    row(
      "score",
      "Puntaje",
      a ? String(a.score) : "—",
      b ? String(b.score) : "—",
      a?.score ?? null,
      b?.score ?? null,
      (d) => formatSignedNumber(d, 0),
    ),
  ];
}

export function alarmFromLog(log: ErpDayLog | undefined) {
  if (!log) return null;
  const rangAt = log.alarm.rangAt;
  const startedWorkAt = log.alarm.startedWorkAt;
  const snoozedTimes = log.alarm.snoozedTimes;
  const delay = minutesBetweenTimes(rangAt, startedWorkAt);
  return {
    rangAt,
    snoozedTimes,
    startedWorkAt,
    delayMinutes: delay,
  };
}

export function workCategoryBars(stats: PeriodStats) {
  return WORK_CATEGORY_META.map((c) => ({
    key: c.key,
    name: c.name,
    color: c.color,
    hours: stats.workByCategory[c.key],
    timers: stats.workTimersByCategory[c.key] ?? [],
  }));
}

export function trainingCategoryCards(stats: PeriodStats) {
  return TRAINING_CATEGORY_META.map((c) => ({
    key: c.key,
    name: c.name,
    color: c.color,
    days: stats.trainingByCategory[c.key],
    minutes: stats.trainingMinutesByCategory[c.key],
  }));
}

export { WORK_CATEGORY_META, TRAINING_CATEGORY_META };
