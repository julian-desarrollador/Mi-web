/** Estado visual de una cuota en panel y calendario */
export type CuotaEstado = "pendiente" | "recordada" | "pagada";

export function getCuotaEstado(c: {
  paid: boolean;
  recordatorioEnviado?: boolean;
}): CuotaEstado {
  if (c.paid) return "pagada";
  if (c.recordatorioEnviado) return "recordada";
  return "pendiente";
}

export const CUOTA_ESTADO_LABEL: Record<CuotaEstado, string> = {
  pendiente: "Cuota esperada",
  recordada: "Cuota recordada",
  pagada: "Cuota pagada",
};

export const cuotaEstadoStyles: Record<
  CuotaEstado,
  {
    row: string;
    rowSub: string;
    card: string;
    badge: string;
    amount: string;
  }
> = {
  pendiente: {
    row: "border-orange-100 bg-orange-50/30",
    rowSub: "border-orange-100 bg-orange-50/20",
    card: "border-orange-200 bg-orange-50/40",
    badge: "bg-orange-100 text-orange-800",
    amount: "text-orange-700",
  },
  recordada: {
    row: "border-blue-200 bg-blue-50/40",
    rowSub: "border-blue-100 bg-blue-50/25",
    card: "border-blue-200 bg-blue-50/50",
    badge: "bg-blue-100 text-blue-800",
    amount: "text-blue-700",
  },
  pagada: {
    row: "border-green-200 bg-green-50/40",
    rowSub: "border-green-100 bg-green-50/25",
    card: "border-green-200 bg-green-50/50",
    badge: "bg-green-100 text-green-800",
    amount: "text-green-700",
  },
};
