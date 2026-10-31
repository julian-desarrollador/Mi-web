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

export type ErpMood = {
  _id: string;
  date: string;
  mood: string;
  startedAt: string;
  endedAt: string | null;
};

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

export function parseMoodStart(
  raw: unknown,
): { ok: true; value: { date: string; mood: string; startedAt: string } } | { ok: false; error: string } {
  const body =
    raw && typeof raw === "object"
      ? (raw as { date?: unknown; mood?: unknown; startedAt?: unknown })
      : {};
  const date = String(body.date ?? "").trim();
  if (!YMD.test(date)) return { ok: false, error: "Fecha requerida (YYYY-MM-DD)" };
  const mood = String(body.mood ?? "").trim().slice(0, MOOD_MAX);
  if (!mood) return { ok: false, error: "El mood es requerido" };
  const startedAt = parseClock(body.startedAt);
  if (!startedAt) return { ok: false, error: "Hora de arranque inválida" };
  return { ok: true, value: { date, mood, startedAt } };
}

export function parseMoodPause(
  raw: unknown,
): { ok: true; value: { id: string; endedAt: string } } | { ok: false; error: string } {
  const body = raw && typeof raw === "object" ? (raw as { id?: unknown; endedAt?: unknown }) : {};
  const id = String(body.id ?? "").trim();
  if (!id) return { ok: false, error: "Falta el mood" };
  const endedAt = parseClock(body.endedAt);
  if (!endedAt) return { ok: false, error: "Hora de pausa inválida" };
  return { ok: true, value: { id, endedAt } };
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
