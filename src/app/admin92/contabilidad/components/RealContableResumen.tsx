"use client";

import { useState } from "react";
import { Eye, EyeOff, Handshake, Smile, Wrench } from "lucide-react";
import ChambaToggle from "@/app/admin92/contabilidad/components/ChambaToggle";
import FlujoCajaModal, { type FlujoCajaRecord } from "@/app/admin92/contabilidad/components/FlujoCajaModal";
import type { CobranzaKpis } from "@/app/admin92/contabilidad/lib/cobranza";

/** Registro contable tal como lo devuelve /api/admin/accounting. */
export type RealContableRecord = FlujoCajaRecord & { chamba?: boolean };

type Props = {
  /** Registros contables del mes mostrado */
  records: RealContableRecord[];
  monthLabel: string;
  /** Sumar ingresos de chamba en los totales */
  includeChamba: boolean;
  onToggleChamba: () => void;
  /** Si viene, se muestran también los cuadros "Cobranza del mes" */
  cobranza?: CobranzaKpis;
  /** Cada sección lleva un botón para mostrar/ocultar sus cuadros (arrancan ocultos) */
  collapsible?: boolean;
};

/** Botón ojo para mostrar/ocultar los cuadros de una sección. */
function SectionToggle({ open, label, onClick }: { open: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-label={open ? `Ocultar ${label}` : `Mostrar ${label}`}
      title={open ? `Ocultar ${label}` : `Mostrar ${label}`}
      className={`rounded-lg border p-1.5 transition-colors cursor-pointer ${
        open ? "border-[#84b9ed]/40 bg-[#84b9ed]/10 text-[#4a7fb8]" : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {open ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
    </button>
  );
}

function categoryIs(category: string | undefined, name: string): boolean {
  return (category || "").trim().toLowerCase() === name;
}

function sum(rows: RealContableRecord[]): number {
  return rows.reduce((total, r) => total + r.amount, 0);
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-AR")} ARS`;
}

/** Cuadros "Real contable" (ingresos, salidas, inversión, resultado) + botón Flujo de caja. */
export default function RealContableResumen({
  records,
  monthLabel,
  includeChamba,
  onToggleChamba,
  cobranza,
  collapsible = false,
}: Props) {
  const [flujoCajaOpen, setFlujoCajaOpen] = useState(false);
  // Sin toggle se ven siempre; con toggle arrancan ocultos
  const [showReal, setShowReal] = useState(!collapsible);

  const ingresos = records.filter((r) => r.type === "ingreso" && (includeChamba || r.chamba !== true));
  const gastos = records.filter((r) => r.type === "gasto");
  const totalIngresos = sum(ingresos);
  const totalGastos = sum(gastos);
  const totalHerramientas = sum(gastos.filter((r) => categoryIs(r.category, "herramientas")));
  const totalPlacer = sum(gastos.filter((r) => categoryIs(r.category, "placer")));
  const totalServicio = sum(gastos.filter((r) => categoryIs(r.category, "servicio")));
  const totalInversion = sum(records.filter((r) => r.type === "inversion"));
  // Placer no resta del resultado
  const resultado =
    totalIngresos - sum(gastos.filter((r) => !categoryIs(r.category, "placer"))) - totalInversion;

  return (
    <div>
      <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {collapsible ? (
            <SectionToggle open={showReal} label="los cuadros" onClick={() => setShowReal((v) => !v)} />
          ) : null}
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Real contable</p>
          <ChambaToggle icon pressed={includeChamba} onClick={onToggleChamba} />
        </div>
        <button
          type="button"
          onClick={() => setFlujoCajaOpen(true)}
          className="rounded-lg border border-[#1d4e89] bg-white px-3 py-1.5 text-xs font-semibold text-[#1d4e89] transition-colors cursor-pointer"
        >
          Flujo de caja
        </button>
      </div>
      {flujoCajaOpen ? (
        <FlujoCajaModal
          monthLabel={monthLabel}
          ingresos={ingresos}
          gastos={gastos}
          onClose={() => setFlujoCajaOpen(false)}
        />
      ) : null}
      {showReal ? (
      <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 mb-1">Ingresos</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalIngresos)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 mb-1">Salidas</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(totalGastos)}</p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-medium text-slate-900">
                <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Herramientas</span>
              </p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(totalHerramientas)}</p>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-medium text-slate-900">
                <Smile className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Placer</span>
              </p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(totalPlacer)}</p>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1 text-xs font-medium text-slate-900">
                <Handshake className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="whitespace-nowrap">Servicio</span>
              </p>
              <p className="text-sm font-semibold text-slate-900">{formatCurrency(totalServicio)}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 mb-1">Inversión</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalInversion)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-600 mb-1">Resultado</p>
          <p className={`text-xl font-bold ${resultado >= 0 ? "text-green-700" : "text-red-700"}`}>
            {formatCurrency(resultado)}
          </p>
        </div>
      </div>
      ) : null}
      {/* Cobranza del mes: mismo grupo (se muestra/oculta con el mismo ojo) */}
      {showReal && cobranza ? (
        <div className="mt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-400">Cobranza del mes</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600 mb-1">Esperado</p>
              <p className="text-xl font-bold text-amber-800">{formatCurrency(cobranza.esperado)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600 mb-1">Cobrado</p>
              <p className="text-xl font-bold text-green-700">{formatCurrency(cobranza.cobrado)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-600 mb-1">Pendiente</p>
              <p className="text-xl font-bold text-orange-700">{formatCurrency(cobranza.pendiente)}</p>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  );
}
