import { getMonthKey, getMonthKeySafe } from "@/app/admin92/contabilidad/lib/utils";

export type CobranzaKpis = { esperado: number; cobrado: number; pendiente: number };

type CobroCobranza = {
  amount: number;
  dueDate: string;
  paid: boolean;
  fechaCobro?: string;
  accountingRecordId?: string;
  chamba?: boolean;
};

/**
 * Cobranza del mes (Contabilidad):
 * - Esperado / Pendiente: cuotas que vencen en el mes.
 * - Cobrado: cuotas pagadas cuyo ingreso contable cae en el mes (fecha del registro vinculado,
 *   o fecha de cobro / vencimiento si no hay registro).
 */
export function computeCobranzaKpis(
  cobros: CobroCobranza[],
  month: string,
  recordDateById: Map<string, string | Date>,
  includeChamba: boolean,
): CobranzaKpis {
  const cuenta = (c: CobroCobranza) => includeChamba || c.chamba !== true;
  const inMonth = cobros.filter((c) => getMonthKeySafe(c.dueDate) === month && cuenta(c));
  const esperado = inMonth.reduce((sum, c) => sum + c.amount, 0);
  const pendiente = inMonth.filter((c) => !c.paid).reduce((sum, c) => sum + c.amount, 0);
  const cobrado = cobros
    .filter((c) => {
      if (!cuenta(c) || !c.paid) return false;
      if (c.accountingRecordId) {
        const recDate = recordDateById.get(c.accountingRecordId);
        if (recDate) return getMonthKey(recDate) === month;
      }
      return getMonthKeySafe(c.fechaCobro || c.dueDate) === month;
    })
    .reduce((sum, c) => sum + c.amount, 0);
  return { esperado, cobrado, pendiente };
}
