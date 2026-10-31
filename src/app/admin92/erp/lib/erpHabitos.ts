export const HABITO_MAX = 2000;

export const HABITOS_INICIALES = [
  "Comenzar dándole play al timer, luego algo de fondo si querés.",
  "Practicar la paz mental, la limpieza mental, no tener mucho ruido. Buscá trabajar con pomodoro. La atención tiene que estar dirigida al objetivo y tiene que haber paz. Es malo tener la atención muy dividida y con ruido. Si es contenido de aprendizaje, bueno.",
  "Meter 4 hs antes del almuerzo.",
] as const;

export type ErpHabito = {
  _id: string;
  text: string;
  order: number;
};

export function parseHabitoText(raw: unknown): { ok: true; text: string } | { ok: false; error: string } {
  const text = String(raw ?? "").trim().slice(0, HABITO_MAX);
  if (!text) return { ok: false, error: "El texto es requerido" };
  return { ok: true, text };
}

export const CUATRO_HORAS_NOTA_MAX = 300;

export type CuatroHorasMark = {
  date: string;
  fulfilled: boolean | null;
  note: string;
};

export const MOOD_MAX = 80;
export const MOOD_NOTE_MAX = 200;

/** 1–5: cómo mantuviste la mente durante ese mood. */
export type MoodScore = 1 | 2 | 3 | 4 | 5;

export type ErpMood = {
  _id: string;
  date: string;
  mood: string;
  startedAt: string;
  endedAt: string | null;
  score: MoodScore | null;
  note: string;
};

export function parseMoodScore(raw: unknown): MoodScore | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 5 ? (n as MoodScore) : null;
}

/** Campos de cierre/edición; solo vienen los que se mandaron. */
export type MoodPatch = {
  mood?: string;
  score?: MoodScore | null;
  note?: string;
};

function readMoodPatch(body: Record<string, unknown>): { ok: true; value: MoodPatch } | { ok: false; error: string } {
  const value: MoodPatch = {};
  if (body.mood !== undefined) {
    const mood = String(body.mood ?? "").trim().slice(0, MOOD_MAX);
    if (!mood) return { ok: false, error: "El mood es requerido" };
    value.mood = mood;
  }
  if (body.score !== undefined) {
    if (body.score === null) value.score = null;
    else {
      const score = parseMoodScore(body.score);
      if (score === null) return { ok: false, error: "El puntaje va de 1 a 5" };
      value.score = score;
    }
  }
  if (body.note !== undefined) value.note = String(body.note ?? "").trim().slice(0, MOOD_NOTE_MAX);
  return { ok: true, value };
}

/** Promedio de puntajes (ignora los sin puntaje); null si no hay ninguno. */
export function averageMoodScore(entries: ErpMood[]): number | null {
  const scores = entries.flatMap((entry) => (entry.score ? [entry.score] : []));
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

/** Nombres de mood únicos, el usado más recientemente primero. */
export function recentMoodNames(moods: ErpMood[], limit = 6): string[] {
  const sorted = [...moods].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (clockMinutes(b.startedAt) ?? 0) - (clockMinutes(a.startedAt) ?? 0);
  });
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of sorted) {
    const key = entry.mood.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(entry.mood.trim());
    if (out.length >= limit) break;
  }
  return out;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^(\d{1,2}):(\d{2})$/;

export function parseClock(raw: unknown): string | null {
  const match = CLOCK.exec(String(raw ?? "").trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

export type MoodStartInput = {
  date: string;
  mood: string;
  startedAt: string;
  /** Si viene, el mood se crea ya cerrado (ej. puntuado al pausar sin haberlo abierto). */
  endedAt: string | null;
  score: MoodScore | null;
  note: string;
};

export function parseMoodStart(
  raw: unknown,
): { ok: true; value: MoodStartInput } | { ok: false; error: string } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const date = String(body.date ?? "").trim();
  if (!YMD.test(date)) return { ok: false, error: "Fecha requerida (YYYY-MM-DD)" };
  const mood = String(body.mood ?? "").trim().slice(0, MOOD_MAX);
  if (!mood) return { ok: false, error: "El mood es requerido" };
  const startedAt = parseClock(body.startedAt);
  if (!startedAt) return { ok: false, error: "Hora de arranque inválida" };
  let endedAt: string | null = null;
  if (body.endedAt !== undefined && body.endedAt !== null) {
    endedAt = parseClock(body.endedAt);
    if (!endedAt) return { ok: false, error: "Hora de pausa inválida" };
  }
  const patch = readMoodPatch({ score: body.score, note: body.note });
  if (!patch.ok) return patch;
  return {
    ok: true,
    value: {
      date,
      mood,
      startedAt,
      endedAt,
      score: patch.value.score ?? null,
      note: patch.value.note ?? "",
    },
  };
}

/** PATCH: con `endedAt` cierra el mood abierto; sin `endedAt` solo edita mood/score/note. */
export function parseMoodPause(
  raw: unknown,
): { ok: true; value: { id: string; endedAt: string | null; patch: MoodPatch } } | { ok: false; error: string } {
  const body = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = String(body.id ?? "").trim();
  if (!id) return { ok: false, error: "Falta el mood" };
  let endedAt: string | null = null;
  if (body.endedAt !== undefined && body.endedAt !== null) {
    endedAt = parseClock(body.endedAt);
    if (!endedAt) return { ok: false, error: "Hora de pausa inválida" };
  }
  const patch = readMoodPatch(body);
  if (!patch.ok) return patch;
  if (!endedAt && Object.keys(patch.value).length === 0) {
    return { ok: false, error: "Nada para actualizar" };
  }
  return { ok: true, value: { id, endedAt, patch: patch.value } };
}

export function parseCuatroHorasMark(
  raw: unknown,
): { ok: true; value: CuatroHorasMark } | { ok: false; error: string } {
  const body =
    raw && typeof raw === "object"
      ? (raw as { date?: unknown; fulfilled?: unknown; note?: unknown })
      : {};
  const date = String(body.date ?? "").trim();
  if (!YMD.test(date)) return { ok: false, error: "Fecha requerida (YYYY-MM-DD)" };
  if (body.fulfilled !== null && body.fulfilled !== undefined && typeof body.fulfilled !== "boolean") {
    return { ok: false, error: "Indicá si se cumplió o no" };
  }
  const note = String(body.note ?? "").trim().slice(0, CUATRO_HORAS_NOTA_MAX);
  return {
    ok: true,
    value: { date, fulfilled: typeof body.fulfilled === "boolean" ? body.fulfilled : null, note },
  };
}

function clockMinutes(value: string): number | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/** Minutos de `start` a `end`. Si `end` es anterior, cuenta el cruce de medianoche. */
export function minutesBetween(start: string, end: string): number | null {
  const from = clockMinutes(start);
  const to = clockMinutes(end);
  if (from === null || to === null) return null;
  const diff = to - from;
  return diff >= 0 ? diff : diff + 24 * 60;
}

export function formatClock(value: string): string {
  const total = clockMinutes(value);
  if (total === null) return value;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest}`;
}

export function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}
