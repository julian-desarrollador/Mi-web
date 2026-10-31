"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  DESARROLLO50_SERVICIOS,
} from "@/app/admin92/contabilidad/lib/desarrollos50Labels";
import {
  mapDesarrollo50Doc,
  sortDesarrollos50,
  type Desarrollo50Item,
} from "@/app/admin92/contabilidad/lib/desarrollos50";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { formatLocalDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import Desarrollo50TasksBlock from "@/app/admin92/contabilidad/components/Desarrollo50TasksBlock";

type Props = {
  onCountChange?: (count: number) => void;
  onAccountingChange?: () => void;
};

function formatArs(n: number) {
  return `$${n.toLocaleString("es-AR")} ARS`;
}

export default function Desarrollos50Panel({ onCountChange, onAccountingChange }: Props) {
  const [items, setItems] = useState<Desarrollo50Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [finalTarget, setFinalTarget] = useState<Desarrollo50Item | null>(null);
  const [finalFecha, setFinalFecha] = useState(todayYmd());
  const [finalMonto, setFinalMonto] = useState("");

  const [formCliente, setFormCliente] = useState("");
  const [formNombre, setFormNombre] = useState("");
  const [formServicio, setFormServicio] = useState<string>("Web");
  const [formMonto, setFormMonto] = useState("");
  const [formFecha, setFormFecha] = useState(todayYmd());

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/desarrollos-50");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar los desarrollos.");
      const list = Array.isArray(data.desarrollos)
        ? sortDesarrollos50(data.desarrollos.map(mapDesarrollo50Doc))
        : [];
      setItems(list);
      onCountChange?.(list.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(formMonto);
    if (!formCliente.trim() || !formNombre.trim()) {
      setError("Cliente y nombre del desarrollo son requeridos.");
      return;
    }
    if (Number.isNaN(monto) || monto <= 0) {
      setError("El monto del 50% inicial debe ser un número positivo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/desarrollos-50", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: formCliente.trim(),
          name: formNombre.trim(),
          servicio: formServicio,
          montoCobrado50: monto,
          fechaCobro50: formFecha,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo crear el desarrollo.");
      setFormCliente("");
      setFormNombre("");
      setFormMonto("");
      setFormFecha(todayYmd());
      setShowForm(false);
      await load();
      onAccountingChange?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear.");
    } finally {
      setSaving(false);
    }
  };

  const openCobrarFinal = (d: Desarrollo50Item) => {
    setFinalTarget(d);
    setFinalFecha(todayYmd());
    setFinalMonto(d.montoCobrado50 !== undefined ? String(d.montoCobrado50) : "");
    setError("");
  };

  const handleCobrarFinal = async () => {
    if (!finalTarget) return;
    const monto = parseFloat(finalMonto);
    if (Number.isNaN(monto) || monto <= 0) {
      setError("El monto del 50% final debe ser un número positivo.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `/api/admin/desarrollos-50/${finalTarget.id}/cobrar-final`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fechaCobro50Final: finalFecha,
            montoCobrado50Final: monto,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo registrar el cobro final.");
      setFinalTarget(null);
      await load();
      onAccountingChange?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cobrar el 50% final.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (d: Desarrollo50Item) => {
    const msg = [
      `¿Eliminar el desarrollo "${d.clientName} — ${d.name}"?`,
      "",
      "Se borrará el registro del desarrollo y el ingreso del 1.er 50%.",
      "Esta acción no se puede deshacer.",
    ].join("\n");
    if (!window.confirm(msg)) return;

    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/desarrollos-50/${d.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar el desarrollo.");
      if (finalTarget?.id === d.id) setFinalTarget(null);
      await load();
      onAccountingChange?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <p className="text-xs text-slate-500">Cargando desarrollos…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-600">
          Ningún desarrollo 50% en curso. Usá el formulario de abajo para registrar el primer
          cobro.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((d) => (
            <li
              key={d.id}
              className="rounded-md border border-sky-100 bg-white/90 px-2.5 py-2 text-xs"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {d.clientName}
                    <span className="font-normal text-slate-500"> — {d.name}</span>
                  </p>
                  <p className="text-slate-600 mt-0.5">
                    {d.type !== "—" ? `${d.type} · ` : ""}
                    {d.fechaCobro50
                      ? `1.er 50% el ${formatLocalDate(d.fechaCobro50)}`
                      : "1.er 50% registrado"}
                    {d.montoCobrado50 !== undefined ? ` · ${formatArs(d.montoCobrado50)}` : ""}
                  </p>
                </div>
                {finalTarget?.id !== d.id && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => openCobrarFinal(d)}
                      className="rounded-md bg-sky-600 px-2.5 py-1 text-[10px] font-medium text-white cursor-pointer disabled:opacity-50"
                    >
                      Cobrar 50% final
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void handleDelete(d)}
                      title="Eliminar desarrollo"
                      aria-label="Eliminar desarrollo"
                      className="rounded-md p-1 text-slate-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {finalTarget?.id === d.id && (
                <div className="mt-2 flex flex-wrap items-end gap-2 border-t border-sky-100 pt-2">
                  <label className="text-[11px] text-slate-700">
                    Fecha cobro final
                    <DatePickerField
                      value={finalFecha}
                      onChange={setFinalFecha}
                      className="mt-0.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    />
                  </label>
                  <label className="text-[11px] text-slate-700">
                    Monto (ARS)
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={finalMonto}
                      onChange={(e) => setFinalMonto(e.target.value)}
                      className="mt-0.5 block w-28 rounded border border-slate-300 px-2 py-1 text-xs"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCobrarFinal()}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white cursor-pointer disabled:opacity-50"
                  >
                    Confirmar y cerrar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setFinalTarget(null)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-600 cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              )}
              <div className="mt-2 border-t border-sky-100 pt-2">
                <Desarrollo50TasksBlock
                  desarrollo={d}
                  onUpdated={() => {
                    void load();
                    onAccountingChange?.();
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {showForm ? (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="rounded-md border border-sky-200 bg-white p-2.5 space-y-2"
        >
          <p className="text-xs font-semibold text-sky-900">Nuevo desarrollo 50%</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={formCliente}
              onChange={(e) => setFormCliente(e.target.value)}
              placeholder="Cliente"
              className="rounded border border-slate-300 px-2 py-1.5 text-xs"
            />
            <input
              type="text"
              value={formNombre}
              onChange={(e) => setFormNombre(e.target.value)}
              placeholder="Nombre del desarrollo"
              className="rounded border border-slate-300 px-2 py-1.5 text-xs"
            />
            <select
              value={formServicio}
              onChange={(e) => setFormServicio(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1.5 text-xs cursor-pointer"
            >
              {DESARROLLO50_SERVICIOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              step="0.01"
              value={formMonto}
              onChange={(e) => setFormMonto(e.target.value)}
              placeholder="Monto 50% inicial (ARS)"
              className="rounded border border-slate-300 px-2 py-1.5 text-xs"
            />
            <DatePickerField
              value={formFecha}
              onChange={setFormFecha}
              aria-label="Fecha del 50% inicial"
              className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Registrar 1.er 50%"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => {
            setShowForm(true);
            setError("");
          }}
          className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2.5 py-1.5 text-xs font-medium text-sky-800 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo desarrollo 50%
        </button>
      )}
    </div>
  );
}
