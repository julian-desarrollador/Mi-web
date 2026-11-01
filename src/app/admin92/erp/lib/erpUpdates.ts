/** Updates listas para entregar (📦 en el timer live del ERP). Lógica compartida cliente/API. */

export type ErpUpdate = {
  id: string;
  proyecto: string;
  nota: string;
  /** Cuándo quedó lista (YYYY-MM-DD) */
  listaFecha: string;
  listaHora?: string;
  /** Entrega planeada (opcional) */
  entregaFecha?: string;
  entregaHora?: string;
  /** Se cumplió la entrega */
  entregada: boolean;
  /** Cuándo se tildó como entregada (ISO) */
  entregadaAt?: string;
  createdAt?: string;
};

export type EntregaEstado = "entregada" | "atrasada" | "hoy" | "planeada" | "sin-fecha";

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"] as const;

export function isYmd(v: unknown): v is string {
  return typeof v === "string" && YMD.test(v);
}

export function isHm(v: unknown): v is string {
  return typeof v === "string" && HM.test(v);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function localYmd(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localHm(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "dom 1/11 · 19:27 hs" (la hora solo si existe). */
export function formatUpdateFecha(fecha: string, hora?: string): string {
  if (!isYmd(fecha)) return "—";
  const [y, m, d] = fecha.split("-").map(Number);
  const dia = DIAS[new Date(y, m - 1, d).getDay()];
  return `${dia} ${d}/${m}${hora && isHm(hora) ? ` · ${hora} hs` : ""}`;
}

/** Fecha y hora local de un ISO (para "Entregada el …"). */
export function formatUpdateInstant(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatUpdateFecha(localYmd(date), localHm(date));
}

export function entregaEstado(u: ErpUpdate, today: string): EntregaEstado {
  if (u.entregada) return "entregada";
  if (!u.entregaFecha) return "sin-fecha";
  if (u.entregaFecha < today) return "atrasada";
  if (u.entregaFecha === today) return "hoy";
  return "planeada";
}

/** Pendientes: entrega planeada más cercana primero (sin fecha al final), luego por fecha de lista. */
export function comparePendientes(a: ErpUpdate, b: ErpUpdate): number {
  const ea = a.entregaFecha ? `${a.entregaFecha} ${a.entregaHora ?? "99:99"}` : "9999";
  const eb = b.entregaFecha ? `${b.entregaFecha} ${b.entregaHora ?? "99:99"}` : "9999";
  if (ea !== eb) return ea.localeCompare(eb);
  const la = `${a.listaFecha} ${a.listaHora ?? ""}`;
  const lb = `${b.listaFecha} ${b.listaHora ?? ""}`;
  return la.localeCompare(lb);
}

export function mapErpUpdate(raw: {
  _id?: string;
  id?: string;
  proyecto?: string;
  nota?: string;
  listaFecha?: string;
  listaHora?: string;
  entregaFecha?: string;
  entregaHora?: string;
  entregada?: boolean;
  entregadaAt?: string;
  createdAt?: string;
}): ErpUpdate {
  // Updates viejas sin fecha de lista: se usa la fecha de creación
  const created = raw.createdAt ? new Date(raw.createdAt) : null;
  const createdOk = created && !Number.isNaN(created.getTime()) ? created : null;
  return {
    id: raw.id || raw._id || "",
    proyecto: raw.proyecto ?? "",
    nota: raw.nota ?? "",
    listaFecha: isYmd(raw.listaFecha) ? raw.listaFecha : createdOk ? localYmd(createdOk) : localYmd(),
    listaHora: isHm(raw.listaHora) ? raw.listaHora : !raw.listaFecha && createdOk ? localHm(createdOk) : undefined,
    entregaFecha: isYmd(raw.entregaFecha) ? raw.entregaFecha : undefined,
    entregaHora: isHm(raw.entregaHora) ? raw.entregaHora : undefined,
    entregada: Boolean(raw.entregada),
    entregadaAt: raw.entregadaAt || undefined,
    createdAt: raw.createdAt,
  };
}

export const UPDATE_FECHA_KEYS = ["listaFecha", "listaHora", "entregaFecha", "entregaHora"] as const;
export type UpdateFechaKey = (typeof UPDATE_FECHA_KEYS)[number];

/**
 * Fechas/horas presentes en el body de la API. `set` = valores válidos; `unset` = opcionales
 * vaciados ("" o null). listaFecha no se puede vaciar.
 */
export function parseUpdateFechas(body: Record<string, unknown>): {
  set: Partial<Record<UpdateFechaKey, string>>;
  unset: UpdateFechaKey[];
  error?: string;
} {
  const set: Partial<Record<UpdateFechaKey, string>> = {};
  const unset: UpdateFechaKey[] = [];
  for (const key of UPDATE_FECHA_KEYS) {
    if (!(key in body)) continue;
    const raw = body[key];
    const value = raw === null || raw === undefined ? "" : String(raw).trim();
    if (!value) {
      if (key === "listaFecha") return { set, unset, error: "La fecha de lista es requerida" };
      unset.push(key);
      continue;
    }
    const ok = key.endsWith("Fecha") ? isYmd(value) : isHm(value);
    if (!ok) return { set, unset, error: `Formato inválido en ${key}` };
    set[key] = value;
  }
  // Sin fecha de entrega no tiene sentido la hora de entrega
  if (unset.includes("entregaFecha") && !unset.includes("entregaHora")) {
    delete set.entregaHora;
    unset.push("entregaHora");
  }
  return { set, unset };
}
