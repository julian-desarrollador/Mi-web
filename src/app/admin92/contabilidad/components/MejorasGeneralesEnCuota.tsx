"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  conHecho,
  etiquetaAplicacion,
  mismaAplicacion,
  useMejorasGenerales,
  type AplicacionRef,
  type MejoraGeneral,
} from "@/app/admin92/contabilidad/lib/mejorasGenerales";
import {
  ConfirmarEntrega,
  FechaEditable,
} from "@/app/admin92/contabilidad/components/MejoraGeneralFechas";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  clientName: string;
  servicio?: string;
};

/** Mejoras generales que incluyen a esta aplicación, con el check de esta sola. */
export default function MejorasGeneralesEnCuota({ clientName, servicio }: Props) {
  const app: AplicacionRef = { clientName, ...(servicio?.trim() ? { servicio: servicio.trim() } : {}) };
  const { items, saving, error, setAplicaciones, setFecha } = useMejorasGenerales();
  /** Tilde a la espera de la fecha de entrega */
  const [pendiente, setPendiente] = useState<{ mejoraId: string; fecha: string } | null>(null);
  const propias = items.filter((mejora) => mejora.aplicaciones.some((item) => mismaAplicacion(item, app)));
  if (propias.length === 0 && !error) return null;

  const guardarHecho = (mejora: MejoraGeneral, done: boolean, fecha?: string) => {
    const next = mejora.aplicaciones.map((item) =>
      mismaAplicacion(item, app) ? conHecho(item, done, fecha) : item,
    );
    void setAplicaciones(mejora.id, next);
  };

  return (
    <div className="border-t border-slate-100 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Mejoras generales</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <ul className="space-y-1.5">
        {propias.map((mejora) => {
          const asignada = mejora.aplicaciones.find((item) => mismaAplicacion(item, app));
          if (!asignada) return null;
          return (
            <li key={mejora.id}>
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  disabled={saving}
                  aria-pressed={asignada.done}
                  aria-label={asignada.done ? `Desmarcar ${mejora.text}` : `Marcar hecha: ${mejora.text}`}
                  onClick={() => {
                    // Destildar es inmediato; tildar pregunta antes cuándo se entregó
                    if (asignada.done) {
                      setPendiente(null);
                      guardarHecho(mejora, false);
                    } else {
                      setPendiente({ mejoraId: mejora.id, fecha: todayYmd() });
                    }
                  }}
                  className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border cursor-pointer disabled:opacity-50 ${
                    asignada.done
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                >
                  <Check className="h-3 w-3" />
                </button>
                <div className="min-w-0 flex-1">
                  <span className={`text-sm ${asignada.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                    {mejora.text}
                    <span className="ml-1 text-xs text-slate-400">{etiquetaAplicacion(app)}</span>
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                    <FechaEditable
                      label="Anotada"
                      value={mejora.createdAt}
                      disabled={saving}
                      onChange={(ymd) => void setFecha(mejora.id, ymd)}
                    />
                    {asignada.done ? (
                      <FechaEditable
                        label="Entregada"
                        tone="done"
                        value={asignada.fechaRealizada ?? ""}
                        disabled={saving}
                        onChange={(ymd) => guardarHecho(mejora, true, ymd)}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
              {pendiente?.mejoraId === mejora.id ? (
                <ConfirmarEntrega
                  text={mejora.text}
                  fecha={pendiente.fecha}
                  saving={saving}
                  onFechaChange={(ymd) => setPendiente((prev) => (prev ? { ...prev, fecha: ymd } : prev))}
                  onCancel={() => setPendiente(null)}
                  onConfirm={() => {
                    guardarHecho(mejora, true, pendiente.fecha);
                    setPendiente(null);
                  }}
                />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
