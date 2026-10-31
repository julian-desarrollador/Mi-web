export type AccountingType = "ingreso" | "gasto" | "inversion";

export type AccountingRecord = {
  _id?: string;
  type: AccountingType;
  amount: number;
  description: string;
  category?: string;
  date: string;
  createdAt: string;
};

export type Cobro = {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt?: string;
  fechaCobro?: string;
  servicio?: string;
  origen?: "manual" | "suscripcion_mp";
  notes?: string;
  estadisticasEnviadas?: boolean;
  fechaEnvioEstadisticas?: string;
  recordatorioEnviado?: boolean;
  accountingRecordId?: string;
  /** Prioridad manual en cola de cambios (0 = más urgente) */
  prioridad?: number;
};

export const typeLabels: Record<AccountingType, string> = {
  ingreso: "Ingreso",
  gasto: "Salida",
  inversion: "Inversión",
};

export const typeColors: Record<AccountingType, string> = {
  ingreso: "bg-green-100 text-green-800",
  gasto: "bg-red-100 text-red-800",
  inversion: "bg-blue-100 text-blue-800",
};

/** Colores de puntitos del calendario (inversión + cuotas + desarrollos 50%) */
export const MARKER_COLORS = {
  inversion: "#6366f1",
  cuotaPendiente: "#f97316",
  cuotaRecordada: "#3b82f6",
  cuotaPagada: "#16a34a",
  /** Mismo verde que cuota pagada: 1.er 50% ya cobrado */
  desarrollo50: "#16a34a",
} as const;

export const BORDER_COLORS = {
  /** Ámbar vivo — borde punteado alerta (cambio) */
  cambio: "#f59e0b",
  /** Violeta más luminoso — borde punteado alerta (stats) */
  stats: "#c084fc",
} as const;

/** Leyenda del calendario (texto fijo para evitar desajustes SSR/cliente) */
export const CALENDAR_LEGEND = [
  { color: MARKER_COLORS.inversion, label: "Inversión" },
  { color: MARKER_COLORS.cuotaPendiente, label: "Cuota pendiente" },
  { color: MARKER_COLORS.cuotaRecordada, label: "Cuota recordada" },
  { color: MARKER_COLORS.cuotaPagada, label: "Cuota pagada · operación al día" },
  { color: MARKER_COLORS.desarrollo50, label: "Desarrollo 50%" },
] as const;

export const CALENDAR_BORDER_LEGEND = [
  { color: BORDER_COLORS.cambio, label: "Cambio pendiente", style: "dashed" as const },
  { color: BORDER_COLORS.stats, label: "Estadísticas pendientes", style: "dashed" as const },
] as const;
