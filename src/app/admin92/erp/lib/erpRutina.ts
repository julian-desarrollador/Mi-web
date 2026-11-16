/** Rutina diaria del ERP (botón "Rutina"): lista ordenada de pasos. */
export type RutinaPaso = {
  id: string;
  text: string;
};

export const RUTINA_MAX_PASOS = 50;
export const RUTINA_MAX_TEXTO = 300;

/** Se muestra mientras no haya una rutina guardada. */
export const RUTINA_INICIAL: RutinaPaso[] = [
  { id: "inicial-1", text: "Baño: lavarme manos/cara/dientes y cargar mi botella de agua" },
  { id: "inicial-2", text: "Ordenar mi pieza: hacer mi cama, doblar mi ropa" },
  { id: "inicial-3", text: "Comenzar a trabajar" },
  { id: "inicial-4", text: "Desayunar" },
];

export function newRutinaPasoId(): string {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Valida una lista venida de afuera: textos recortados, sin vacíos, con límites. Null si no es un array. */
export function normalizeRutina(raw: unknown): RutinaPaso[] | null {
  if (!Array.isArray(raw)) return null;
  const pasos: RutinaPaso[] = [];
  const ids = new Set<string>();
  for (const item of raw) {
    if (pasos.length >= RUTINA_MAX_PASOS) break;
    if (!item || typeof item !== "object") continue;
    const entry = item as { id?: unknown; text?: unknown };
    const text = typeof entry.text === "string" ? entry.text.trim().slice(0, RUTINA_MAX_TEXTO) : "";
    if (!text) continue;
    let id = typeof entry.id === "string" ? entry.id.trim().slice(0, 64) : "";
    if (!id || ids.has(id)) id = newRutinaPasoId();
    ids.add(id);
    pasos.push({ id, text });
  }
  return pasos;
}

/** "Baño: lavarme..." → { title: "Baño", detail: "lavarme..." }; sin dos puntos, todo es detalle. */
export function splitRutinaPaso(text: string): { title: string; detail: string } {
  const index = text.indexOf(":");
  if (index <= 0 || index > 40) return { title: "", detail: text };
  return { title: text.slice(0, index).trim(), detail: text.slice(index + 1).trim() };
}
