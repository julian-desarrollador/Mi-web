"use client";

import type { CuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import type { CuotaOperativaBorder } from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import { BORDER_COLORS, MARKER_COLORS } from "@/app/admin92/contabilidad/types";

const ESTADO_COLOR: Record<CuotaEstado, string> = {
  pendiente: MARKER_COLORS.cuotaPendiente,
  recordada: MARKER_COLORS.cuotaRecordada,
  pagada: MARKER_COLORS.cuotaPagada,
};

type Props = {
  estado: CuotaEstado;
  border: CuotaOperativaBorder;
  size?: "sm" | "md";
  /** Tiene mejoras sin hacer: anillo cian, por fuera de los de cambio y estadísticas */
  mejora?: boolean;
  /** Cuota del cliente SaaS: el relleno es violeta, no el del estado */
  saas?: boolean;
};

function alertGlow(color: string, kind: "cambio" | "stats" | "mejora" = "cambio"): string {
  if (kind === "stats") {
    // Violeta necesita más bloom para leerse igual de urgente que el ámbar
    return `0 0 4px 1px #e9d5ff, 0 0 10px 3px ${color}ee, 0 0 18px 5px ${color}88`;
  }
  return `0 0 6px 1px ${color}99, 0 0 12px 2px ${color}55`;
}

/** Solo borde punteado (leyenda del calendario, sin relleno) */
export function CalendarLegendBorder({
  border,
  size = "md",
}: {
  border: "cambio" | "stats" | "mejora";
  size?: "sm" | "md";
}) {
  const outer = size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]";
  const ringWidth = size === "sm" ? 2.5 : 3;
  const color = BORDER_COLORS[border];

  return (
    <span
      className={`contabilidad-alert-ring ${outer} shrink-0 rounded-full border-dashed bg-transparent`}
      style={{
        borderWidth: ringWidth,
        borderColor: color,
        boxShadow: alertGlow(color, border),
      }}
      aria-hidden
    />
  );
}

export default function CuotaCalendarDot({ estado, border, size = "sm", mejora = false, saas = false }: Props) {
  const fill = saas ? MARKER_COLORS.cuotaSaas : ESTADO_COLOR[estado];
  const hasCambio = border === "cambio" || border === "both";
  const hasStats = border === "stats" || border === "both";
  const hasBorder = border !== "none" || mejora;

  const outer = size === "sm" ? "h-[18px] w-[18px]" : "h-[22px] w-[22px]";
  const inner = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const saasDot = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";
  const dotClass = saas ? saasDot : inner;
  const dotStyle = saas
    ? {
        backgroundColor: fill,
        boxShadow: "0 0 0 1.5px #ddd6fe, 0 0 7px 2px #7c3aedcc",
      }
    : { backgroundColor: fill };
  const ringWidth = size === "sm" ? 2.5 : 3;
  // Cuánto sobresale el anillo cian: nada si va solo; si no, queda por fuera de los otros
  const mejoraOverflow =
    mejora && border !== "none" ? ringWidth + (border === "both" ? 2 : 0) : 0;

  if (!hasBorder) {
    return (
      <span
        className={`${dotClass} shrink-0 rounded-full`}
        style={dotStyle}
        title={saas ? "SaaS" : undefined}
        aria-hidden
      />
    );
  }

  return (
    <span
      className={`relative flex ${outer} shrink-0 items-center justify-center`}
      // El margen reserva lugar para el anillo exterior y no pisa a los puntitos vecinos
      style={mejoraOverflow ? { margin: mejoraOverflow } : undefined}
      title={[
        hasCambio ? "Cambio pendiente" : null,
        hasStats ? "Estadísticas pendientes" : null,
        mejora ? "Mejoras pendientes" : null,
      ]
        .filter(Boolean)
        .join(" · ")}
      aria-hidden
    >
      <span className={`${dotClass} rounded-full`} style={dotStyle} />
      {hasCambio && (
        <span
          className="contabilidad-alert-ring pointer-events-none absolute inset-0 rounded-full border-dashed"
          style={{
            borderWidth: ringWidth,
            borderColor: BORDER_COLORS.cambio,
            boxShadow: alertGlow(BORDER_COLORS.cambio, "cambio"),
          }}
        />
      )}
      {hasStats && (
        <span
          className={`contabilidad-alert-ring pointer-events-none absolute rounded-full border-dashed ${
            hasCambio ? "-inset-0.5" : "inset-0"
          }`}
          style={{
            borderWidth: ringWidth,
            borderColor: BORDER_COLORS.stats,
            boxShadow: alertGlow(BORDER_COLORS.stats, "stats"),
          }}
        />
      )}
      {mejora && (
        <span
          className="contabilidad-alert-ring pointer-events-none absolute rounded-full border-dashed"
          style={{
            inset: -mejoraOverflow,
            borderWidth: ringWidth,
            borderColor: BORDER_COLORS.mejora,
            boxShadow: alertGlow(BORDER_COLORS.mejora, "mejora"),
          }}
        />
      )}
    </span>
  );
}
