"use client";

import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { formatLocalDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type CobroPendiente = {
  clientName: string;
  amount: number;
  dueDate: string;
};

type Props = {
  cobro: CobroPendiente;
  fechaCobro: string;
  onFechaCobroChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
  formatCurrency: (n: number) => string;
};

export default function ConfirmarPagoCobro({
  cobro,
  fechaCobro,
  onFechaCobroChange,
  onConfirm,
  onCancel,
  confirming = false,
  formatCurrency,
}: Props) {
  return (
    <div className="mb-4 rounded-xl border border-green-200 bg-green-50/60 p-4">
      <p className="text-sm font-semibold text-slate-800 mb-1">
        Marcar pagada: {cobro.clientName} · {formatCurrency(cobro.amount)}
      </p>
      <p className="text-xs text-slate-600 mb-3">
        Vencía el {formatLocalDate(cobro.dueDate)}. El ingreso contable usa la{" "}
        <span className="font-medium">fecha de cobro</span>, no la de vencimiento.
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Vencimiento</label>
          <p className="rounded-lg border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700">
            {formatLocalDate(cobro.dueDate)}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Fecha del cobro</label>
          <DatePickerField
            value={fechaCobro}
            onChange={onFechaCobroChange}
            aria-label="Fecha del cobro"
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
          <button
            type="button"
            onClick={() => onFechaCobroChange(todayYmd())}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => onFechaCobroChange(cobro.dueDate)}
            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 cursor-pointer"
          >
            Mismo día del vencimiento
          </button>
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={confirming || !fechaCobro}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {confirming ? "Guardando..." : "Confirmar pago"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 cursor-pointer disabled:opacity-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
