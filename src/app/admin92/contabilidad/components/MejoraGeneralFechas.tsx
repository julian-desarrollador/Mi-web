"use client";

import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";

/** Fecha chica, sin caja: se ve como texto y se edita al tocarla (igual que en las mejoras de cuota). */
export const FECHA_INLINE_CLASS =
  "rounded px-1 py-0.5 text-xs font-medium border border-transparent hover:border-slate-200 hover:bg-white";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** "Anotada 2/11/2026" o "Entregada 3/11/2026", editable; guarda apenas se elige otro día. */
export function FechaEditable({
  label,
  value,
  disabled,
  onChange,
  tone = "muted",
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (ymd: string) => void;
  tone?: "muted" | "done";
}) {
  const color = tone === "done" ? "text-green-700" : "text-slate-500";
  return (
    <span className={`inline-flex items-center text-xs ${color}`}>
      {label}
      <DatePickerField
        value={value}
        disabled={disabled}
        onChange={(ymd) => {
          if (YMD.test(ymd) && ymd !== value) onChange(ymd);
        }}
        title={`Fecha: ${label.toLowerCase()}`}
        aria-label={`Fecha: ${label.toLowerCase()}`}
        className={`${FECHA_INLINE_CLASS} ${tone === "done" ? "text-green-700" : "text-slate-600"}`}
      />
    </span>
  );
}

/** Pregunta al tildar, como en las mejoras de cuota: "¿Cuándo la entregaste?". */
export function ConfirmarEntrega({
  text,
  fecha,
  saving,
  onFechaChange,
  onCancel,
  onConfirm,
}: {
  text: string;
  fecha: string;
  saving?: boolean;
  onFechaChange: (ymd: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5">
      <p className="text-xs font-semibold text-emerald-900">¿Cuándo la entregaste?</p>
      <p className="mt-0.5 line-clamp-2 text-xs text-slate-700">{text}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DatePickerField
          value={fecha}
          onChange={onFechaChange}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
        />
        <span className="flex-1" />
        <button
          type="button"
          disabled={saving}
          onClick={onCancel}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onConfirm}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
        >
          Marcar entregada
        </button>
      </div>
    </div>
  );
}
