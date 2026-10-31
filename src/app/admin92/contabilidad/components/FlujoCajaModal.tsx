"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Handshake, Smile, Wrench, X } from "lucide-react";
import { formatCurrency, formatLocalDate } from "@/app/admin92/contabilidad/lib/utils";

const GASTO_CATEGORIAS = ["Herramientas", "Placer", "Servicio"] as const;
type GastoCategoria = (typeof GASTO_CATEGORIAS)[number];

const CATEGORIA_ICON = {
  Herramientas: Wrench,
  Placer: Smile,
  Servicio: Handshake,
} as const;

export type FlujoCajaRecord = {
  _id?: string;
  type: "ingreso" | "gasto" | "inversion";
  amount: number;
  description: string;
  category?: string;
  date: string;
  createdAt: string;
};

type Props = {
  monthLabel: string;
  ingresos: FlujoCajaRecord[];
  gastos: FlujoCajaRecord[];
  onClose: () => void;
};

function byNewest(a: FlujoCajaRecord, b: FlujoCajaRecord): number {
  const byDate = b.date.localeCompare(a.date);
  if (byDate !== 0) return byDate;
  return (b.createdAt || "").localeCompare(a.createdAt || "");
}

function formatRecordDate(date: string): string {
  return formatLocalDate(date.slice(0, 10));
}

function categoryKey(category?: string): string {
  return (category || "").trim().toLowerCase();
}

function RecordTable({ rows, tone }: { rows: FlujoCajaRecord[]; tone: "ingreso" | "gasto" }) {
  if (rows.length === 0) {
    return (
      <p className="px-2 py-6 text-sm text-[#3d5270]">
        {tone === "ingreso" ? "Sin ingresos este mes." : "Sin salidas para este filtro."}
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#c5d4e8]">
            <th className="px-2 py-3 text-left font-semibold text-[#0f2744]">Fecha</th>
            <th className="px-2 py-3 text-left font-semibold text-[#0f2744]">Descripción</th>
            <th className="px-2 py-3 text-left font-semibold text-[#0f2744]">Categoría</th>
            <th className="px-2 py-3 text-right font-semibold text-[#0f2744]">Monto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row._id || row.createdAt} className="border-b border-[#c5d4e8]">
              <td className="px-2 py-3 text-[#3d5270]">{formatRecordDate(row.date)}</td>
              <td className="px-2 py-3 text-[#0f2744]">{row.description}</td>
              <td className="px-2 py-3 text-[#3d5270]">{row.category || "—"}</td>
              <td
                className={`px-2 py-3 text-right font-medium ${
                  tone === "gasto" ? "text-[#9f1239]" : "text-[#166534]"
                }`}
              >
                {tone === "gasto" ? "-" : "+"}
                {formatCurrency(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FlujoCajaModal({ monthLabel, ingresos, gastos, onClose }: Props) {
  const [filters, setFilters] = useState<GastoCategoria[]>([...GASTO_CATEGORIAS]);
  const allFiltersOn = filters.length === GASTO_CATEGORIAS.length;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const ingresosOrdenados = useMemo(() => [...ingresos].sort(byNewest), [ingresos]);
  const totalIngresos = ingresosOrdenados.reduce((sum, row) => sum + row.amount, 0);
  const gastosVisibles = useMemo(() => {
    const selected = new Set(filters.map((item) => item.toLowerCase()));
    return gastos
      .filter((row) => {
        const key = categoryKey(row.category);
        if (!key) return allFiltersOn;
        return selected.has(key);
      })
      .sort(byNewest);
  }, [allFiltersOn, filters, gastos]);
  const totalSalidas = gastosVisibles.reduce((sum, row) => sum + row.amount, 0);

  const toggleFilter = (category: GastoCategoria) => {
    setFilters((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-neutral-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="flujo-caja-title"
        className="flex max-h-[min(42rem,90vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#c5d4e8] bg-white p-5"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="flujo-caja-title" className="text-lg font-semibold text-[#0f2744]">
              Flujo de caja
            </h2>
            <p className="mt-0.5 text-sm text-[#3d5270]">{monthLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-lg p-1.5 text-[#3d5270] transition hover:text-[#0f2744] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-2">
          <section className="min-w-0 rounded-xl border border-[#c5d4e8] bg-white p-3">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-[#166534]">Ingresos</h3>
              <p className="mt-1 text-xl font-bold text-[#166534]">{formatCurrency(totalIngresos)}</p>
            </div>
            <RecordTable rows={ingresosOrdenados} tone="ingreso" />
          </section>
          <section className="min-w-0 rounded-xl border border-[#c5d4e8] bg-white p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#9f1239]">Salidas</h3>
                <p className="mt-1 text-xl font-bold text-[#9f1239]">{formatCurrency(totalSalidas)}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {GASTO_CATEGORIAS.map((category) => {
                  const on = filters.includes(category);
                  const Icon = CATEGORIA_ICON[category];
                  return (
                    <button
                      key={category}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleFilter(category)}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold cursor-pointer ${
                        on
                          ? "border-[#1d4e89] bg-[#1d4e89] text-white"
                          : "border-[#c5d4e8] bg-white text-[#0f2744]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                      {category}
                    </button>
                  );
                })}
              </div>
            </div>
            <RecordTable rows={gastosVisibles} tone="gasto" />
          </section>
        </div>
      </article>
    </div>,
    document.body,
  );
}
