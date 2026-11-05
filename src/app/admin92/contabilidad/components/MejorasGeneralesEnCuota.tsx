"use client";

import { Check } from "lucide-react";
import {
  etiquetaAplicacion,
  mismaAplicacion,
  useMejorasGenerales,
  type AplicacionRef,
  type MejoraGeneralAplicacion,
} from "@/app/admin92/contabilidad/lib/mejorasGenerales";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  clientName: string;
  servicio?: string;
};

function conHecho(app: MejoraGeneralAplicacion, done: boolean): MejoraGeneralAplicacion {
  if (!done) {
    return { clientName: app.clientName, ...(app.servicio ? { servicio: app.servicio } : {}), done: false };
  }
  return {
    clientName: app.clientName,
    ...(app.servicio ? { servicio: app.servicio } : {}),
    done: true,
    fechaRealizada: app.fechaRealizada || todayYmd(),
  };
}

/** Mejoras generales que incluyen a esta aplicación, con el check de esta sola. */
export default function MejorasGeneralesEnCuota({ clientName, servicio }: Props) {
  const app: AplicacionRef = { clientName, ...(servicio?.trim() ? { servicio: servicio.trim() } : {}) };
  const { items, saving, error, setAplicaciones } = useMejorasGenerales();
  const propias = items.filter((mejora) => mejora.aplicaciones.some((item) => mismaAplicacion(item, app)));
  if (propias.length === 0 && !error) return null;

  return (
    <div className="border-t border-slate-100 px-3 py-2.5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-800">Mejoras generales</p>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <ul className="space-y-1.5">
        {propias.map((mejora) => {
          const asignada = mejora.aplicaciones.find((item) => mismaAplicacion(item, app));
          if (!asignada) return null;
          return (
            <li key={mejora.id} className="flex items-start gap-2">
              <button
                type="button"
                disabled={saving}
                aria-pressed={asignada.done}
                aria-label={asignada.done ? `Desmarcar ${mejora.text}` : `Marcar hecha: ${mejora.text}`}
                onClick={() => {
                  const next = mejora.aplicaciones.map((item) =>
                    mismaAplicacion(item, app) ? conHecho(item, !item.done) : item,
                  );
                  void setAplicaciones(mejora.id, next);
                }}
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border cursor-pointer disabled:opacity-50 ${
                  asignada.done
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-transparent"
                }`}
              >
                <Check className="h-3 w-3" />
              </button>
              <span className={`text-sm ${asignada.done ? "text-slate-400 line-through" : "text-slate-800"}`}>
                {mejora.text}
                <span className="ml-1 text-xs text-slate-400">{etiquetaAplicacion(app)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
