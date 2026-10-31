"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import {
  CARTERA_CURRENCIES,
  CARTERA_KIND_LABELS,
  CARTERA_KINDS,
  formatCarteraMoney,
  formatCarteraQty,
  formatPnlPct,
  holdingCost,
  holdingMarketValue,
  holdingPnlPct,
  summarizeCartera,
  type CarteraCurrency,
  type CarteraHolding,
  type CarteraHoldingInput,
  type CarteraKind,
} from "@/app/admin92/contabilidad/cartera/lib/carteraTypes";

const EMPTY_FORM = {
  name: "",
  ticker: "",
  kind: "cedear" as CarteraKind,
  quantity: "",
  avgCost: "",
  currency: "USD" as CarteraCurrency,
  currentPrice: "",
  notes: "",
};

type FormState = typeof EMPTY_FORM;

function holdingToForm(holding: CarteraHolding): FormState {
  return {
    name: holding.name,
    ticker: holding.ticker ?? "",
    kind: holding.kind,
    quantity: String(holding.quantity),
    avgCost: String(holding.avgCost),
    currency: holding.currency,
    currentPrice: holding.currentPrice === null ? "" : String(holding.currentPrice),
    notes: holding.notes,
  };
}

function formToInput(form: FormState): CarteraHoldingInput {
  return {
    name: form.name.trim(),
    ticker: form.ticker.trim() || null,
    kind: form.kind,
    quantity: Number(form.quantity),
    avgCost: Number(form.avgCost),
    currency: form.currency,
    currentPrice: form.currentPrice.trim() === "" ? null : Number(form.currentPrice),
    notes: form.notes.trim(),
  };
}

function FormSelect<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-slate-900 cursor-pointer"
      >
        <span>{selected}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-300 bg-white py-1 shadow-lg">
          {options.map((option) => {
            const active = option.value === value;
            return (
              <li key={option.value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm font-medium cursor-pointer ${
                    active
                      ? "bg-sky-100 text-slate-950"
                      : "bg-white text-slate-900"
                  }`}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function CarteraPage({
  holdings,
  loading,
  saving,
  error,
  onCreate,
  onUpdate,
  onDelete,
}: {
  holdings: CarteraHolding[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  onCreate: (input: CarteraHoldingInput) => Promise<void>;
  onUpdate: (id: string, input: CarteraHoldingInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const totals = useMemo(() => summarizeCartera(holdings), [holdings]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const startCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const startEdit = (holding: CarteraHolding) => {
    setForm(holdingToForm(holding));
    setEditingId(holding._id);
    setShowForm(true);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const input = formToInput(form);
    try {
      if (editingId) {
        await onUpdate(editingId, input);
      } else {
        await onCreate(input);
      }
      resetForm();
      setShowForm(false);
    } catch {
      // El error ya se muestra en el banner de la página.
    }
  };

  const handleDelete = async (holding: CarteraHolding) => {
    const ok = window.confirm(`¿Eliminar ${holding.name}?`);
    if (!ok) return;
    try {
      await onDelete(holding._id);
      if (editingId === holding._id) {
        resetForm();
        setShowForm(false);
      }
    } catch {
      // El error ya se muestra en el banner de la página.
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin92/contabilidad"
              aria-label="Volver a contabilidad"
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-500 shadow-sm transition hover:text-slate-900"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Cartera de inversiones
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Holdings con precio a mano. La cotización automática queda para después.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={showForm && !editingId ? () => { resetForm(); setShowForm(false); } : startCreate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            {showForm && !editingId ? "Ocultar formulario" : "Agregar activo"}
          </button>
        </header>

        {error && (
          <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Cargando cartera…
            </div>
          ) : totals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Todavía no hay activos. Cargá el primero para ver invertido, valor actual y resultado.
            </div>
          ) : (
            totals.map((bucket) => (
              <article
                key={bucket.currency}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Totales {bucket.currency}
                </p>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Invertido</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {formatCarteraMoney(bucket.invested, bucket.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Valor actual</p>
                    <p className="mt-1 text-sm font-bold text-blue-700">
                      {formatCarteraMoney(bucket.market, bucket.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium text-slate-500">Resultado</p>
                    <p
                      className={`mt-1 text-sm font-bold ${
                        bucket.pnl >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {formatCarteraMoney(bucket.pnl, bucket.currency)}
                    </p>
                  </div>
                </div>
                {bucket.unpriced > 0 && (
                  <p className="mt-3 text-xs text-slate-400">
                    {bucket.unpriced} sin precio actual · el resultado usa solo los cotizados
                  </p>
                )}
              </article>
            ))
          )}
        </section>

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Editar activo" : "Nuevo activo"}
              </h2>
              {editingId && (
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancelar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700">Nombre</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Apple, SPY, Bitcoin…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Ticker</label>
                <input
                  value={form.ticker}
                  onChange={(e) => setForm((p) => ({ ...p, ticker: e.target.value.toUpperCase() }))}
                  placeholder="AAPL"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Tipo</label>
                <FormSelect
                  ariaLabel="Tipo de activo"
                  value={form.kind}
                  onChange={(kind) => setForm((p) => ({ ...p, kind }))}
                  options={CARTERA_KINDS.map((kind) => ({
                    value: kind,
                    label: CARTERA_KIND_LABELS[kind],
                  }))}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Cantidad</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={form.quantity}
                  onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Costo promedio</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={form.avgCost}
                  onChange={(e) => setForm((p) => ({ ...p, avgCost: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Precio actual</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={form.currentPrice}
                  onChange={(e) => setForm((p) => ({ ...p, currentPrice: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Moneda</label>
                <FormSelect
                  ariaLabel="Moneda"
                  value={form.currency}
                  onChange={(currency) => setForm((p) => ({ ...p, currency }))}
                  options={CARTERA_CURRENCIES.map((currency) => ({
                    value: currency,
                    label: currency,
                  }))}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-1 block text-sm font-medium text-slate-700">Notas</label>
                <input
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="Broker, cuenta, comentario…"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-60 cursor-pointer"
                >
                  {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar"}
                </button>
              </div>
            </div>
          </form>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Activo</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3 text-right">Cantidad</th>
                  <th className="px-4 py-3 text-right">Costo prom.</th>
                  <th className="px-4 py-3 text-right">Precio</th>
                  <th className="px-4 py-3 text-right">Valor</th>
                  <th className="px-4 py-3 text-right">P/L</th>
                  <th className="px-4 py-3 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Cargando…
                    </td>
                  </tr>
                ) : holdings.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Sin holdings todavía.
                    </td>
                  </tr>
                ) : (
                  holdings.map((holding) => {
                    const market = holdingMarketValue(holding);
                    const pnlPct = holdingPnlPct(holding);
                    return (
                      <tr key={holding._id} className="border-b border-slate-100 last:border-0">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{holding.name}</p>
                          <p className="text-xs text-slate-400">
                            {holding.ticker ?? "Sin ticker"} · {holding.currency}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {CARTERA_KIND_LABELS[holding.kind]}
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-slate-800">
                          {formatCarteraQty(holding.quantity)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {formatCarteraMoney(holding.avgCost, holding.currency)}
                          <p className="text-[11px] text-slate-400">
                            {formatCarteraMoney(holdingCost(holding), holding.currency)}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700">
                          {holding.currentPrice === null
                            ? "—"
                            : formatCarteraMoney(holding.currentPrice, holding.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {market === null ? "—" : formatCarteraMoney(market, holding.currency)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold ${
                            pnlPct === null
                              ? "text-slate-400"
                              : pnlPct >= 0
                                ? "text-green-700"
                                : "text-red-700"
                          }`}
                        >
                          {formatPnlPct(pnlPct)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => startEdit(holding)}
                              aria-label={`Editar ${holding.name}`}
                              className="rounded-lg p-2 text-slate-500 hover:text-slate-900 cursor-pointer"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(holding)}
                              aria-label={`Eliminar ${holding.name}`}
                              className="rounded-lg p-2 text-slate-500 hover:text-rose-700 cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
