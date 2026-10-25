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

export type CuatroHorasMark = {
  date: string;
  fulfilled: boolean;
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseCuatroHorasMark(
  raw: unknown,
): { ok: true; value: CuatroHorasMark } | { ok: false; error: string } {
  const body = raw && typeof raw === "object" ? (raw as { date?: unknown; fulfilled?: unknown }) : {};
  const date = String(body.date ?? "").trim();
  if (!YMD.test(date)) return { ok: false, error: "Fecha requerida (YYYY-MM-DD)" };
  if (typeof body.fulfilled !== "boolean") {
    return { ok: false, error: "Indicá si se cumplió o no" };
  }
  return { ok: true, value: { date, fulfilled: body.fulfilled } };
}
