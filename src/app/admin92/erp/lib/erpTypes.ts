export type ErpWorkHours = {
  software: number;
  saas: number;
  planificacion: number;
  branding: number;
  itNews: number;
  stremear: number;
};

/** Timer individual dentro de una categoría de trabajo */
export type ErpWorkTimerItem = {
  id: string;
  text: string;
  done: boolean;
};

export type ErpTimeKind = "promesa" | "conocimiento";

/** Focus: una cuota, el tramo entero. Repartido: un tramo partido entre varias. */
export type ErpTimerShare = "focus" | "repartido";

/** Una cuota (focus), un conjunto (repartido), o un tiempo sin cuota. */
export type ErpTimerDestino = {
  /** Focus: el tramo entero es de este cliente. */
  cuotaClient?: string;
  /** Conjunto: el tramo se parte entre estas cuotas, en este orden. */
  cuotaClients?: string[];
  /** Sin marca en timers viejos = focus. */
  share?: ErpTimerShare;
  timeKind?: ErpTimeKind;
};

export type ErpWorkTimer = {
  name: string;
  /** Duración en segundos (desde H:MM:SS del paste o timer live) */
  seconds: number;
  /** Cliente de la cuota, si este rato es para alguien que ya paga */
  cuotaClient?: string;
  /** Conjunto de cuotas cuando el tramo es repartido */
  cuotaClients?: string[];
  share?: ErpTimerShare;
  /** Tiempo sin cuota: promesa de ingresos o conocimiento */
  timeKind?: ErpTimeKind;
  /** Checklist / ramas bajo este timer (ej. Analia → conectar wpp) */
  items?: ErpWorkTimerItem[];
};

/** Timer en curso (uno solo por día) */
export type ErpActiveWorkTimer = {
  category: WorkCategoryKey;
  name: string;
  cuotaClient?: string;
  cuotaClients?: string[];
  share?: ErpTimerShare;
  timeKind?: ErpTimeKind;
  /** ISO: inicio del tramo actual */
  startedAt: string;
  items: ErpWorkTimerItem[];
};

/** Sesión de entrenamiento: done + minutos opcionales + notas (series, etc.) */
export type ErpTrainingSession = {
  done: boolean;
  /** Duración en minutos; null = no registrada */
  minutes: number | null;
  /** Ej. "3 series bíceps, 2 abs" */
  notes?: string;
};

export type ErpTraining = {
  gimnasio: ErpTrainingSession;
  natacion: ErpTrainingSession;
  casa: ErpTrainingSession;
};

/** @deprecated preferir ErpTraining */
export type ErpTrainingFlags = ErpTraining;

export type ErpAlarm = {
  /** HH:MM; null = no cargado */
  rangAt: string | null;
  /** null = no cargado */
  snoozedTimes: number | null;
  /** HH:MM; null = no cargado */
  startedWorkAt: string | null;
};

export type ErpDayLog = {
  date: string; // YYYY-MM-DD
  alarm: ErpAlarm;
  work: ErpWorkHours;
  /** Desglose de timers por categoría; docs viejos → vacíos */
  workTimers: ErpWorkTimers;
  /** Timer live en curso (máx. uno); null/undefined = ninguno */
  activeWorkTimer?: ErpActiveWorkTimer | null;
  training: ErpTraining;
  /** Práctica de inglés, separada del entrenamiento físico */
  english: ErpTrainingSession;
  /** Tomó creatina ese día */
  creatine: boolean;
  /** null = no registrado ese día */
  sleepHours: number | null;
  /** 4 comidas del día: hecha + calidad 1–5 opcional */
  food: ErpFood;
  notes?: string;
};

export type MealKey = "desayuno" | "almuerzo" | "merienda" | "cena";

export type ErpMeal = {
  done: boolean;
  /** 1–5 si la comida está hecha; null si no calificó */
  quality: number | null;
};

export type ErpFood = Record<MealKey, ErpMeal>;

export const MEAL_META: { key: MealKey; label: string }[] = [
  { key: "desayuno", label: "Desayuno" },
  { key: "almuerzo", label: "Almuerzo" },
  { key: "merienda", label: "Merienda" },
  { key: "cena", label: "Cena" },
];

export function emptyMeal(done = false): ErpMeal {
  return { done, quality: null };
}

export function emptyFood(): ErpFood {
  return {
    desayuno: emptyMeal(),
    almuerzo: emptyMeal(),
    merienda: emptyMeal(),
    cena: emptyMeal(),
  };
}

export function normalizeFood(raw: unknown): ErpFood {
  const base = emptyFood();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  for (const { key } of MEAL_META) {
    const meal = record[key];
    if (!meal || typeof meal !== "object") continue;
    const entry = meal as Partial<ErpMeal>;
    const done = Boolean(entry.done);
    const quality =
      done &&
      typeof entry.quality === "number" &&
      Number.isInteger(entry.quality) &&
      entry.quality >= 1 &&
      entry.quality <= 5
        ? entry.quality
        : null;
    base[key] = { done, quality };
  }
  return base;
}

export function countMealsDone(food: ErpFood): number {
  return MEAL_META.reduce((sum, { key }) => sum + (food[key].done ? 1 : 0), 0);
}

export function avgMealQuality(food: ErpFood): number | null {
  const qualities = MEAL_META.map(({ key }) => food[key])
    .filter((meal) => meal.done && meal.quality !== null)
    .map((meal) => meal.quality as number);
  if (qualities.length === 0) return null;
  return qualities.reduce((a, b) => a + b, 0) / qualities.length;
}

/** Pago mensual de un servicio (gimnasio / pileta / Cursor) */
export type ErpServicePayment = {
  paid: boolean;
  amount: number | null;
  /** Día en que se pagó (YYYY-MM-DD); null si no se cargó */
  paidOn: string | null;
};

export type ErpMembershipServiceKey = "gimnasio" | "natacion" | "cursor";

/** Estado de cuotas del mes YYYY-MM */
export type ErpMembershipMonth = {
  month: string;
  gimnasio: ErpServicePayment;
  natacion: ErpServicePayment;
  cursor: ErpServicePayment;
};

export function emptyServicePayment(): ErpServicePayment {
  return { paid: false, amount: null, paidOn: null };
}

export function emptyMembershipMonth(month: string): ErpMembershipMonth {
  return {
    month,
    gimnasio: emptyServicePayment(),
    natacion: emptyServicePayment(),
    cursor: emptyServicePayment(),
  };
}

export function validateErpMembershipMonth(
  raw: unknown,
  expectedMonth?: string,
): { ok: true; membership: ErpMembershipMonth } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "El registro de cuotas es inválido" };
  }
  const value = raw as Record<string, unknown>;
  const month =
    typeof value.month === "string" ? value.month : expectedMonth ?? "";
  if (!/^\d{4}-\d{2}$/.test(month) || (expectedMonth && month !== expectedMonth)) {
    return { ok: false, error: "El mes es inválido" };
  }

  const parseService = (
    key: ErpMembershipServiceKey,
  ): ErpServicePayment | { error: string } => {
    const service = value[key];
    // Docs viejos sin `cursor`: tratar como no pagado
    if (service === undefined || service === null) {
      if (key === "cursor") return emptyServicePayment();
      return { error: `Los datos de ${key} son inválidos` };
    }
    if (typeof service !== "object") {
      return { error: `Los datos de ${key} son inválidos` };
    }
    const entry = service as Record<string, unknown>;
    if (typeof entry.paid !== "boolean") {
      return { error: `El estado de pago de ${key} es inválido` };
    }

    let amount: number | null = null;
    if (entry.amount !== null && entry.amount !== undefined && entry.amount !== "") {
      const n = Number(entry.amount);
      if (!Number.isFinite(n) || n < 0) {
        return { error: `El monto de ${key} es inválido` };
      }
      amount = n;
    }

    let paidOn: string | null = null;
    if (entry.paidOn !== null && entry.paidOn !== undefined && entry.paidOn !== "") {
      if (typeof entry.paidOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.paidOn)) {
        return { error: `La fecha de pago de ${key} es inválida` };
      }
      paidOn = entry.paidOn;
    }

    if (!entry.paid) {
      paidOn = null;
    }

    return { paid: entry.paid, amount, paidOn };
  };

  const gimnasio = parseService("gimnasio");
  if ("error" in gimnasio) return { ok: false, error: gimnasio.error };
  const natacion = parseService("natacion");
  if ("error" in natacion) return { ok: false, error: natacion.error };
  const cursor = parseService("cursor");
  if ("error" in cursor) return { ok: false, error: cursor.error };

  return {
    ok: true,
    membership: { month, gimnasio, natacion, cursor },
  };
}

export type WorkCategoryKey = keyof ErpWorkHours;
export type TrainingCategoryKey = keyof ErpTraining;

export type ErpWorkTimers = Record<WorkCategoryKey, ErpWorkTimer[]>;

export const WORK_CATEGORY_META: {
  key: WorkCategoryKey;
  name: string;
  shortLabel: string;
  color: string;
}[] = [
  { key: "software", name: "Software development", shortLabel: "Software", color: "#2563eb" },
  { key: "saas", name: "SaaS", shortLabel: "SaaS", color: "#7c3aed" },
  { key: "planificacion", name: "Planificación", shortLabel: "Planificación", color: "#0891b2" },
  { key: "branding", name: "Branding / Marketing", shortLabel: "Branding", color: "#ea580c" },
  { key: "itNews", name: "IT News", shortLabel: "IT News", color: "#0f766e" },
  { key: "stremear", name: "Stremear", shortLabel: "Stremear", color: "#db2777" },
];

export const TRAINING_CATEGORY_META: {
  key: TrainingCategoryKey;
  name: string;
  color: string;
}[] = [
  { key: "gimnasio", name: "Gimnasio", color: "#7c3aed" },
  { key: "natacion", name: "Natación", color: "#0284c7" },
  { key: "casa", name: "Entrenamiento en casa", color: "#059669" },
];

export const EMPTY_WORK: ErpWorkHours = {
  software: 0,
  saas: 0,
  planificacion: 0,
  branding: 0,
  itNews: 0,
  stremear: 0,
};

export function emptyWorkTimers(): ErpWorkTimers {
  return {
    software: [],
    saas: [],
    planificacion: [],
    branding: [],
    itNews: [],
    stremear: [],
  };
}

export function newWorkTimerItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalizeWorkTimerItems(raw: unknown): ErpWorkTimerItem[] {
  if (!Array.isArray(raw)) return [];
  const items: ErpWorkTimerItem[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim().slice(0, 300) : "";
    if (!text) continue;
    const id =
      typeof row.id === "string" && row.id.trim()
        ? row.id.trim().slice(0, 80)
        : newWorkTimerItemId();
    items.push({ id, text, done: Boolean(row.done) });
  }
  return items.slice(0, 40);
}

export function normalizeActiveWorkTimer(raw: unknown): ErpActiveWorkTimer | null {
  if (raw == null) return null;
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const category = row.category;
  if (
    category !== "software" &&
    category !== "saas" &&
    category !== "planificacion" &&
    category !== "branding" &&
    category !== "itNews" &&
    category !== "stremear"
  ) {
    return null;
  }
  const name = typeof row.name === "string" ? row.name.trim().slice(0, 200) : "";
  const startedAt = typeof row.startedAt === "string" ? row.startedAt : "";
  if (!startedAt || Number.isNaN(Date.parse(startedAt))) return null;
  const destino = readTimerDestino(row);
  return {
    category,
    name,
    ...destino,
    startedAt,
    items: normalizeWorkTimerItems(row.items),
  };
}

export function elapsedActiveSeconds(
  active: ErpActiveWorkTimer,
  nowMs: number = Date.now(),
): number {
  const start = Date.parse(active.startedAt);
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 1000));
}

function mergeWorkTimerItems(
  existing: ErpWorkTimerItem[] | undefined,
  incoming: ErpWorkTimerItem[],
): ErpWorkTimerItem[] {
  const byId = new Map<string, ErpWorkTimerItem>();
  for (const item of existing ?? []) byId.set(item.id, item);
  for (const item of incoming) {
    const prev = byId.get(item.id);
    byId.set(item.id, prev ? { ...prev, ...item, text: item.text || prev.text } : item);
  }
  return [...byId.values()].slice(0, 40);
}

function uniqueCuotaNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const names: string[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    if (typeof entry !== "string") continue;
    const name = entry.trim().slice(0, 120);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    names.push(name);
    if (names.length >= 20) break;
  }
  return names;
}

/** Partes iguales. El sobrante de segundos queda en las primeras de la lista. */
export function splitEvenSeconds(total: number, count: number): number[] {
  const safe = Number.isFinite(total) ? Math.max(0, Math.round(total)) : 0;
  if (count <= 0) return [];
  const base = Math.floor(safe / count);
  let rest = safe - base * count;
  return Array.from({ length: count }, () => {
    const extra = rest > 0 ? 1 : 0;
    if (rest > 0) rest -= 1;
    return base + extra;
  });
}

export function repartidoSecondsForClient(
  clients: string[] | undefined,
  totalSeconds: number,
  clientName: string,
): number {
  if (!clients || clients.length < 2) return 0;
  const index = clients.findIndex(
    (client) => client.trim().toLowerCase() === clientName.trim().toLowerCase(),
  );
  if (index < 0) return 0;
  return splitEvenSeconds(totalSeconds, clients.length)[index] ?? 0;
}

export function readTimerDestino(raw: {
  cuotaClient?: unknown;
  cuotaClients?: unknown;
  timeKind?: unknown;
} | null | undefined): ErpTimerDestino {
  if (!raw) return {};
  const clients = uniqueCuotaNames(raw.cuotaClients);
  const single = typeof raw.cuotaClient === "string" ? raw.cuotaClient.trim().slice(0, 120) : "";
  if (clients.length >= 2) return { cuotaClients: clients, share: "repartido" };
  if (clients.length === 1) return { cuotaClient: clients[0], share: "focus" };
  if (single) return { cuotaClient: single, share: "focus" };
  if (raw.timeKind === "promesa" || raw.timeKind === "conocimiento") {
    return { timeKind: raw.timeKind };
  }
  return {};
}

export function timerDestinoKey(destino: ErpTimerDestino | null | undefined): string {
  if (destino?.share === "repartido" && destino.cuotaClients && destino.cuotaClients.length >= 2) {
    return `repartido:${destino.cuotaClients.map((client) => client.trim().toLowerCase()).join("|")}`;
  }
  if (destino?.cuotaClient) return `cuota:${destino.cuotaClient.trim().toLowerCase()}`;
  if (destino?.timeKind) return destino.timeKind;
  return "";
}

function sameWorkTimerIdentity(
  timer: ErpTimerDestino & { name: string },
  name: string,
  destino: ErpTimerDestino | undefined,
): boolean {
  return (
    timer.name.trim().toLowerCase() === name.trim().toLowerCase() &&
    timerDestinoKey(timer) === timerDestinoKey(destino)
  );
}

/** Nombre por defecto si el timer live se detiene sin título */
export const UNNAMED_WORK_TIMER = "Sin nombre";

export function resolveWorkTimerName(name: string): string {
  const trimmed = name.trim().slice(0, 200);
  return trimmed || UNNAMED_WORK_TIMER;
}

/** Detiene el timer activo y acumula segundos + items en workTimers del día. */
export function stopActiveWorkTimerOnLog(
  log: ErpDayLog,
  nowMs: number = Date.now(),
): ErpDayLog {
  const active = normalizeActiveWorkTimer(log.activeWorkTimer ?? null);
  if (!active) return { ...log, activeWorkTimer: null };

  const elapsed = elapsedActiveSeconds(active, nowMs);
  const resolvedName = resolveWorkTimerName(active.name);
  const workTimers = normalizeWorkTimers(log.workTimers);
  const list = [...workTimers[active.category]];
  const idx = list.findIndex((t) =>
    sameWorkTimerIdentity(t, resolvedName, active),
  );
  if (idx >= 0) {
    const prev = list[idx];
    list.splice(idx, 1);
    list.push({
      name: prev.name,
      seconds: prev.seconds + elapsed,
      ...readTimerDestino(prev),
      items: mergeWorkTimerItems(prev.items, active.items),
    });
  } else {
    list.push({
      name: resolvedName,
      seconds: elapsed,
      ...readTimerDestino(active),
      items: active.items,
    });
  }
  workTimers[active.category] = list;

  const work = normalizeWork(log.work);
  work[active.category] = (work[active.category] ?? 0) + elapsed / 3600;

  return {
    ...log,
    work,
    workTimers,
    activeWorkTimer: null,
  };
}

export function startActiveWorkTimerOnLog(
  log: ErpDayLog,
  category: WorkCategoryKey,
  name: string,
  nowMs: number = Date.now(),
  destino?: ErpTimerDestino,
): ErpDayLog {
  const trimmed = name.trim().slice(0, 200);
  const cleanDestino = readTimerDestino(destino);
  let next = log.activeWorkTimer ? stopActiveWorkTimerOnLog(log, nowMs) : log;
  const existing = trimmed
    ? normalizeWorkTimers(next.workTimers)[category].find((t) =>
        sameWorkTimerIdentity(t, trimmed, cleanDestino),
      )
    : undefined;
  next = {
    ...next,
    activeWorkTimer: {
      category,
      name: existing?.name ?? trimmed,
      ...cleanDestino,
      startedAt: new Date(nowMs).toISOString(),
      items: existing?.items ? [...existing.items] : [],
    },
  };
  return next;
}

export function normalizeWorkTimers(raw: unknown): ErpWorkTimers {
  const base = emptyWorkTimers();
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as WorkCategoryKey[]) {
    const list = record[key];
    if (!Array.isArray(list)) continue;
    const timers: ErpWorkTimer[] = [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const entry = item as Record<string, unknown>;
      const name = typeof entry.name === "string" ? entry.name.trim().slice(0, 200) : "";
      const seconds = Number(entry.seconds);
      if (!name || !Number.isFinite(seconds) || seconds < 0) continue;
      const items = normalizeWorkTimerItems(entry.items);
      const destino = readTimerDestino(entry);
      timers.push({
        name,
        seconds: Math.round(seconds),
        ...destino,
        ...(items.length > 0 ? { items } : {}),
      });
    }
    base[key] = timers;
  }
  return base;
}

export function sumWorkTimerSeconds(timers: ErpWorkTimer[]): number {
  return timers.reduce((sum, t) => sum + t.seconds, 0);
}

export function workHoursFromTimers(timers: ErpWorkTimers): ErpWorkHours {
  const work = { ...EMPTY_WORK };
  for (const key of Object.keys(work) as WorkCategoryKey[]) {
    work[key] = sumWorkTimerSeconds(timers[key]) / 3600;
  }
  return work;
}

export function normalizeWork(raw: unknown): ErpWorkHours {
  const base = { ...EMPTY_WORK };
  if (!raw || typeof raw !== "object") return base;
  const record = raw as Record<string, unknown>;
  for (const key of Object.keys(base) as WorkCategoryKey[]) {
    const n = Number(record[key]);
    base[key] = Number.isFinite(n) && n >= 0 ? n : 0;
  }
  return base;
}

export function emptyTrainingSession(done = false): ErpTrainingSession {
  return { done, minutes: null, notes: "" };
}

/** Natación siempre dura 1 hora fija */
export const NATACION_FIXED_MINUTES = 60;

/** Inglés siempre dura 1 hora fija */
export const ENGLISH_FIXED_MINUTES = 60;

/** Minutos efectivos de una sesión (natación = siempre 60 si está hecha) */
export function effectiveTrainingMinutes(
  key: TrainingCategoryKey,
  session: ErpTrainingSession | boolean | undefined,
): number {
  if (!isTrainingDone(session)) return 0;
  if (key === "natacion") return NATACION_FIXED_MINUTES;
  if (session == null || typeof session === "boolean") return 0;
  return session.minutes ?? 0;
}

/** Minutos efectivos de inglés (siempre 60 si está hecho) */
export function effectiveEnglishMinutes(
  session: ErpTrainingSession | boolean | undefined,
): number {
  if (!isTrainingDone(session)) return 0;
  return ENGLISH_FIXED_MINUTES;
}

export const EMPTY_TRAINING: ErpTraining = {
  gimnasio: emptyTrainingSession(),
  natacion: emptyTrainingSession(),
  casa: emptyTrainingSession(),
};

export function emptyDayLog(date: string): ErpDayLog {
  return {
    date,
    alarm: { rangAt: null, snoozedTimes: null, startedWorkAt: null },
    work: { ...EMPTY_WORK },
    workTimers: emptyWorkTimers(),
    activeWorkTimer: null,
    training: {
      gimnasio: emptyTrainingSession(),
      natacion: emptyTrainingSession(),
      casa: emptyTrainingSession(),
    },
    english: emptyTrainingSession(),
    creatine: false,
    sleepHours: null,
    food: emptyFood(),
    notes: "",
  };
}

export function normalizeAlarm(raw: unknown): ErpAlarm {
  if (!raw || typeof raw !== "object") {
    return { rangAt: null, snoozedTimes: null, startedWorkAt: null };
  }
  const alarm = raw as Partial<ErpAlarm>;
  const rangAt =
    typeof alarm.rangAt === "string" && isValidTime(alarm.rangAt) ? alarm.rangAt : null;
  const startedWorkAt =
    typeof alarm.startedWorkAt === "string" && isValidTime(alarm.startedWorkAt)
      ? alarm.startedWorkAt
      : null;
  const snoozed =
    typeof alarm.snoozedTimes === "number" &&
    Number.isInteger(alarm.snoozedTimes) &&
    alarm.snoozedTimes >= 0
      ? alarm.snoozedTimes
      : null;

  // Defaults viejos del formulario vacío (07:00 → 08:00, 0 snooze) = sin cargar
  if (rangAt === "07:00" && startedWorkAt === "08:00" && snoozed === 0) {
    return { rangAt: null, snoozedTimes: null, startedWorkAt: null };
  }

  return { rangAt, snoozedTimes: snoozed, startedWorkAt };
}

export function sumWorkHours(work: ErpWorkHours): number {
  return (Object.keys(EMPTY_WORK) as WorkCategoryKey[]).reduce(
    (sum, key) => sum + (work[key] ?? 0),
    0,
  );
}

/** Minutos entre HH:MM y HH:MM (mismo día; si end < start asume end al día siguiente) */
export function minutesBetweenTimes(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  if (!start || !end) return null;
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

/**
 * Parsea duración a horas decimales.
 * Acepta: "4:52", "4:5", "4", "4.5", "4,5".
 */
export function parseDurationToHours(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(",", ".");
  if (!s) return 0;

  if (s.includes(":")) {
    const [hPart, mPart = "0"] = s.split(":");
    const h = parseInt(hPart, 10);
    const m = parseInt(mPart.padStart(2, "0").slice(0, 2), 10);
    if (Number.isNaN(h) || Number.isNaN(m) || m < 0 || m > 59) return null;
    return Math.max(0, h + m / 60);
  }

  const n = parseFloat(s);
  if (Number.isNaN(n) || n < 0) return null;
  return n;
}

/** Formatea horas decimales como "4:52" */
export function formatHoursAsHm(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0:00";
  const totalMins = Math.round(hours * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

/** Formatea minutos totales como "1:30"; vacío si no hay dato */
export function formatMinutesAsHm(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return "";
  if (minutes === 0) return "0:00";
  return formatHoursAsHm(minutes / 60);
}

/**
 * Parsea duración a minutos totales con el mismo formato que trabajo:
 * "1:30", "1", "1.5" → minutos.
 */
export function parseDurationToMinutes(raw: string): number | null {
  const hours = parseDurationToHours(raw);
  if (hours === null) return null;
  return Math.round(hours * 60);
}

/** Parsea solo minutos enteros ("45", "45m", "45min") */
export function parseMinutes(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  const m = /^(\d+)\s*(m|min|mins|minutos)?$/.exec(s);
  if (!m) return null;
  return Math.max(0, parseInt(m[1], 10));
}

export function isTrainingDone(session: ErpTrainingSession | boolean | undefined): boolean {
  if (session == null) return false;
  if (typeof session === "boolean") return session;
  return Boolean(session.done);
}

/** Normaliza mocks viejos (boolean) al shape nuevo */
export function normalizeTraining(raw: unknown): ErpTraining {
  const asRecord = (raw ?? {}) as Record<string, unknown>;
  const one = (key: TrainingCategoryKey): ErpTrainingSession => {
    const v = asRecord[key];
    if (typeof v === "boolean") {
      if (!v) return emptyTrainingSession(false);
      return {
        done: true,
        minutes: key === "natacion" ? NATACION_FIXED_MINUTES : null,
        notes: "",
      };
    }
    if (v && typeof v === "object") {
      const o = v as Partial<ErpTrainingSession>;
      const done = Boolean(o.done);
      let minutes = typeof o.minutes === "number" ? o.minutes : null;
      if (key === "natacion" && done) minutes = NATACION_FIXED_MINUTES;
      return {
        done,
        minutes,
        notes: typeof o.notes === "string" ? o.notes : "",
      };
    }
    return emptyTrainingSession();
  };
  return {
    gimnasio: one("gimnasio"),
    natacion: one("natacion"),
    casa: one("casa"),
  };
}

function isValidYmd(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

function isValidTime(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export type ErpDayLogValidation =
  | { ok: true; log: ErpDayLog }
  | { ok: false; error: string };

/**
 * Valida y normaliza un log recibido desde una fuente externa (API/Mongo).
 * Mantiene la fecha como YYYY-MM-DD para evitar desfases por zona horaria.
 */
export function validateErpDayLog(
  raw: unknown,
  expectedDate?: string,
): ErpDayLogValidation {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "El registro del día es inválido" };
  }

  const value = raw as Record<string, unknown>;
  const date = typeof value.date === "string" ? value.date : expectedDate ?? "";
  if (!isValidYmd(date) || (expectedDate !== undefined && date !== expectedDate)) {
    return { ok: false, error: "La fecha es inválida" };
  }

  const alarm = value.alarm as Record<string, unknown> | undefined;
  const parseOptionalTime = (raw: unknown): string | null | undefined => {
    if (raw === null || raw === undefined || raw === "") return null;
    if (typeof raw !== "string" || !isValidTime(raw)) return undefined;
    return raw;
  };
  const rangAt = parseOptionalTime(alarm?.rangAt);
  const startedWorkAt = parseOptionalTime(alarm?.startedWorkAt);
  if (rangAt === undefined || startedWorkAt === undefined) {
    return { ok: false, error: "Los datos de la alarma son inválidos" };
  }

  let snoozedTimes: number | null = null;
  if (alarm?.snoozedTimes !== null && alarm?.snoozedTimes !== undefined && alarm?.snoozedTimes !== "") {
    const n = Number(alarm.snoozedTimes);
    if (!Number.isInteger(n) || n < 0) {
      return { ok: false, error: "Los datos de la alarma son inválidos" };
    }
    snoozedTimes = n;
  }

  const rawWork = value.work as Record<string, unknown> | undefined;
  const work = { ...EMPTY_WORK };
  for (const key of Object.keys(work) as WorkCategoryKey[]) {
    const raw = rawWork?.[key];
    if (raw === undefined || raw === null || raw === "") {
      work[key] = 0;
      continue;
    }
    const hours = Number(raw);
    if (!Number.isFinite(hours) || hours < 0) {
      return { ok: false, error: `Las horas de ${key} son inválidas` };
    }
    work[key] = hours;
  }

  let workTimers = emptyWorkTimers();
  if (value.workTimers !== undefined && value.workTimers !== null) {
    if (typeof value.workTimers !== "object") {
      return { ok: false, error: "El desglose de timers es inválido" };
    }
    const rawTimers = value.workTimers as Record<string, unknown>;
    for (const key of Object.keys(workTimers) as WorkCategoryKey[]) {
      const list = rawTimers[key];
      if (list === undefined || list === null) {
        workTimers[key] = [];
        continue;
      }
      if (!Array.isArray(list)) {
        return { ok: false, error: `Los timers de ${key} son inválidos` };
      }
      const timers: ErpWorkTimer[] = [];
      for (const item of list) {
        if (!item || typeof item !== "object") {
          return { ok: false, error: `Los timers de ${key} son inválidos` };
        }
        const entry = item as Record<string, unknown>;
        if (typeof entry.name !== "string" || !entry.name.trim()) {
          return { ok: false, error: `Hay un timer sin nombre en ${key}` };
        }
        const seconds = Number(entry.seconds);
        if (!Number.isFinite(seconds) || seconds < 0) {
          return { ok: false, error: `La duración de un timer en ${key} es inválida` };
        }
        const items = normalizeWorkTimerItems(entry.items);
        if (entry.items !== undefined && !Array.isArray(entry.items)) {
          return { ok: false, error: `Los ítems de un timer en ${key} son inválidos` };
        }
        if (entry.cuotaClient !== undefined && entry.cuotaClient !== null && typeof entry.cuotaClient !== "string") {
          return { ok: false, error: `La cuota de un timer en ${key} es inválida` };
        }
        if (
          entry.cuotaClients !== undefined &&
          entry.cuotaClients !== null &&
          (!Array.isArray(entry.cuotaClients) ||
            entry.cuotaClients.some((client) => typeof client !== "string"))
        ) {
          return { ok: false, error: `El conjunto de cuotas de un timer en ${key} es inválido` };
        }
        if (
          entry.timeKind !== undefined &&
          entry.timeKind !== null &&
          entry.timeKind !== "promesa" &&
          entry.timeKind !== "conocimiento"
        ) {
          return { ok: false, error: `El destino de un timer en ${key} es inválido` };
        }
        const destino = readTimerDestino(entry);
        timers.push({
          name: entry.name.trim().slice(0, 200),
          seconds: Math.round(seconds),
          ...destino,
          ...(items.length > 0 ? { items } : {}),
        });
      }
      workTimers[key] = timers;
    }
  }

  let activeWorkTimer: ErpActiveWorkTimer | null = null;
  if (value.activeWorkTimer !== undefined) {
    if (value.activeWorkTimer === null) {
      activeWorkTimer = null;
    } else {
      const parsed = normalizeActiveWorkTimer(value.activeWorkTimer);
      if (!parsed) {
        return { ok: false, error: "El timer activo es inválido" };
      }
      activeWorkTimer = parsed;
    }
  }

  if (!value.training || typeof value.training !== "object") {
    return { ok: false, error: "Los datos de entrenamiento son inválidos" };
  }
  const rawTraining = value.training as Record<string, unknown>;
  for (const key of ["gimnasio", "natacion", "casa"] as TrainingCategoryKey[]) {
    const rawSession = rawTraining[key];
    if (!rawSession || typeof rawSession !== "object") {
      return { ok: false, error: `El entrenamiento de ${key} es inválido` };
    }
    const session = rawSession as Record<string, unknown>;
    if (typeof session.done !== "boolean") {
      return { ok: false, error: `El estado de ${key} es inválido` };
    }
    if (
      session.minutes !== null &&
      session.minutes !== undefined &&
      (typeof session.minutes !== "number" ||
        !Number.isInteger(session.minutes) ||
        session.minutes < 0)
    ) {
      return { ok: false, error: `Los minutos de ${key} son inválidos` };
    }
    if (session.notes !== undefined && typeof session.notes !== "string") {
      return { ok: false, error: `El detalle de ${key} es inválido` };
    }
  }

  const training = normalizeTraining(rawTraining);
  for (const key of Object.keys(training) as TrainingCategoryKey[]) {
    const session = training[key];
    if (
      session.minutes !== null &&
      (!Number.isInteger(session.minutes) || session.minutes < 0)
    ) {
      return { ok: false, error: `Los minutos de ${key} son inválidos` };
    }
    session.notes = (session.notes ?? "").trim().slice(0, 1000);
  }

  const rawEnglish = value.english;
  let english = emptyTrainingSession();
  if (rawEnglish !== undefined) {
    if (!rawEnglish || typeof rawEnglish !== "object") {
      return { ok: false, error: "Los datos de inglés son inválidos" };
    }
    const session = rawEnglish as Record<string, unknown>;
    if (typeof session.done !== "boolean") {
      return { ok: false, error: "El estado de inglés es inválido" };
    }
    if (
      session.minutes !== null &&
      session.minutes !== undefined &&
      (typeof session.minutes !== "number" ||
        !Number.isInteger(session.minutes) ||
        session.minutes < 0)
    ) {
      return { ok: false, error: "Los minutos de inglés son inválidos" };
    }
    if (session.notes !== undefined && typeof session.notes !== "string") {
      return { ok: false, error: "El detalle de inglés es inválido" };
    }
    english = {
      done: session.done,
      minutes: session.done
        ? ENGLISH_FIXED_MINUTES
        : typeof session.minutes === "number"
          ? session.minutes
          : null,
      notes: typeof session.notes === "string" ? session.notes.trim().slice(0, 1000) : "",
    };
  }

  let creatine = false;
  if (value.creatine !== undefined) {
    if (typeof value.creatine !== "boolean") {
      return { ok: false, error: "El estado de creatina es inválido" };
    }
    creatine = value.creatine;
  }

  const nullableNumber = (
    input: unknown,
    min: number,
    max: number,
  ): number | null | undefined => {
    if (input === null || input === undefined || input === "") return null;
    const number = Number(input);
    if (!Number.isFinite(number) || number < min || number > max) return undefined;
    return number;
  };

  const sleepHours = nullableNumber(value.sleepHours, 0, 24);
  if (sleepHours === undefined) {
    return { ok: false, error: "Las horas de sueño son inválidas" };
  }

  let food = emptyFood();
  if (value.food !== undefined) {
    if (!value.food || typeof value.food !== "object") {
      return { ok: false, error: "Los datos de alimentación son inválidos" };
    }
    const rawFood = value.food as Record<string, unknown>;
    for (const { key, label } of MEAL_META) {
      const meal = rawFood[key];
      if (!meal || typeof meal !== "object") {
        return { ok: false, error: `${label}: datos inválidos` };
      }
      const entry = meal as Record<string, unknown>;
      if (typeof entry.done !== "boolean") {
        return { ok: false, error: `${label}: estado inválido` };
      }
      if (!entry.done) {
        food[key] = emptyMeal(false);
        continue;
      }
      if (entry.quality === null || entry.quality === undefined || entry.quality === "") {
        food[key] = { done: true, quality: null };
        continue;
      }
      const quality = Number(entry.quality);
      if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
        return { ok: false, error: `${label}: la calidad debe ser 1–5` };
      }
      food[key] = { done: true, quality };
    }
  }

  return {
    ok: true,
    log: {
      date,
      alarm: { rangAt, snoozedTimes, startedWorkAt },
      work,
      workTimers,
      activeWorkTimer,
      training,
      english,
      creatine,
      sleepHours,
      food,
      notes: typeof value.notes === "string" ? value.notes.trim().slice(0, 5000) : "",
    },
  };
}
