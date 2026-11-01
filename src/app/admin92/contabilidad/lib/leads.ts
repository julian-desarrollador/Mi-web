/** Leads = desarrollos 50% activos (con o sin 1.er pago) + personas en prueba gratis del SaaS. */

export type LeadPrueba = "14d" | "1m";

export const LEAD_PRUEBA_LABEL: Record<LeadPrueba, string> = {
  "14d": "14 días gratis",
  "1m": "1 mes gratis",
};

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export function isYmd(value: unknown): value is string {
  return typeof value === "string" && YMD.test(value);
}

export function normalizePrueba(value: unknown): LeadPrueba | undefined {
  return value === "14d" || value === "1m" ? value : undefined;
}

/** Último día de la prueba gratis (YYYY-MM-DD). */
export function getPruebaFin(prueba: LeadPrueba, inicio: string): string {
  const [y, m, d] = inicio.split("-").map(Number);
  const end =
    prueba === "14d"
      ? new Date(y, m - 1, d + 13)
      : (() => {
          // Mismo día del mes siguiente (acotado al último día) menos uno
          const lastNext = new Date(y, m + 1, 0).getDate();
          return new Date(y, m, Math.min(d, lastNext) - 1);
        })();
  return `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
}

/** Días que quedan de prueba contando hoy (0 = vence hoy, negativo = vencida). */
export function getPruebaDiasRestantes(prueba: LeadPrueba, inicio: string, today: string): number {
  const fin = getPruebaFin(prueba, inicio);
  const toUtc = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(fin) - toUtc(today)) / 86_400_000);
}

/**
 * Campos de contacto/origen/prueba de un lead desde el body de la API.
 * Solo devuelve las claves presentes en el body (para PATCH parcial).
 */
export function parseLeadFields(body: Record<string, unknown>): {
  fields: {
    telefono?: string;
    origen?: string;
    prueba?: LeadPrueba;
    pruebaInicio?: string;
  };
  error?: string;
} {
  const fields: {
    telefono?: string;
    origen?: string;
    prueba?: LeadPrueba;
    pruebaInicio?: string;
  } = {};
  if (body.telefono !== undefined) {
    fields.telefono = String(body.telefono ?? "").trim() || undefined;
  }
  if (body.origen !== undefined) {
    fields.origen = String(body.origen ?? "").trim() || undefined;
  }
  if (body.prueba !== undefined) {
    if (body.prueba && !normalizePrueba(body.prueba)) {
      return { fields, error: "Prueba gratis inválida" };
    }
    fields.prueba = normalizePrueba(body.prueba);
  }
  if (body.pruebaInicio !== undefined) {
    if (body.pruebaInicio && !isYmd(body.pruebaInicio)) {
      return { fields, error: "Fecha de inicio de prueba inválida" };
    }
    fields.pruebaInicio = isYmd(body.pruebaInicio) ? body.pruebaInicio : undefined;
  }
  return { fields };
}

/** Link de WhatsApp a partir de un teléfono cargado a mano (deja solo dígitos). */
export function whatsappUrl(telefono: string): string | null {
  const digits = telefono.replace(/\D/g, "");
  return digits.length >= 6 ? `https://wa.me/${digits}` : null;
}
