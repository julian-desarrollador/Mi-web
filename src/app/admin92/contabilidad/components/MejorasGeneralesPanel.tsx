"use client";

import { useState, type FormEvent } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  etiquetaAplicacion,
  mejoraGeneralAbierta,
  mismaAplicacion,
  useMejorasGenerales,
  type AplicacionRef,
  type MejoraGeneral,
  type MejoraGeneralAplicacion,
} from "@/app/admin92/contabilidad/lib/mejorasGenerales";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  aplicacionesDisponibles: AplicacionRef[];
  onSelectAplicacion?: (app: AplicacionRef) => void;
};

function conHecho(
  app: MejoraGeneralAplicacion,
  done: boolean,
): MejoraGeneralAplicacion {
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

function AplicarMenu({
  query,
  onQueryChange,
  apps,
  assigned,
  saving,
  onToggle,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  apps: AplicacionRef[];
  assigned: MejoraGeneralAplicacion[];
  saving: boolean;
  onToggle: (app: AplicacionRef) => void;
}) {
  const q = query.trim().toLowerCase();
  const visibles = q
    ? apps.filter((app) => etiquetaAplicacion(app).toLowerCase().includes(q))
    : apps;

  return (
    <div className="mt-1 rounded-md border border-slate-200 bg-white p-1">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Buscar cliente…"
        aria-label="Buscar a quién aplicar"
        autoFocus
        style={{ backgroundColor: "#ffffff", color: "#0f172a" }}
        className="mb-1 w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
      />
      {visibles.length === 0 ? (
        <p className="px-1 py-1 text-xs text-slate-400">Nadie coincide.</p>
      ) : (
        <ul className="max-h-40 space-y-0.5 overflow-y-auto">
          {visibles.map((app) => {
            const checked = assigned.some((item) => mismaAplicacion(item, app));
            return (
              <li key={etiquetaAplicacion(app)}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs text-slate-800">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={saving}
                    onChange={() => onToggle(app)}
                    className="rounded border-slate-300 text-emerald-600"
                  />
                  <span className="min-w-0 truncate">{etiquetaAplicacion(app)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function MejorasGeneralesPanel({ aplicacionesDisponibles, onSelectAplicacion }: Props) {
  const { items, loading, saving, error, add, remove, setAplicaciones } = useMejorasGenerales();
  const [text, setText] = useState("");
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    void add(trimmed);
    setText("");
  };

  const toggleAsignada = (mejora: MejoraGeneral, app: AplicacionRef) => {
    const ya = mejora.aplicaciones.some((item) => mismaAplicacion(item, app));
    const next = ya
      ? mejora.aplicaciones.filter((item) => !mismaAplicacion(item, app))
      : [
          ...mejora.aplicaciones,
          { clientName: app.clientName, ...(app.servicio ? { servicio: app.servicio } : {}), done: false },
        ];
    void setAplicaciones(mejora.id, next);
  };

  const toggleHecho = (mejora: MejoraGeneral, app: MejoraGeneralAplicacion) => {
    const next = mejora.aplicaciones.map((item) =>
      mismaAplicacion(item, app) ? conHecho(item, !item.done) : item,
    );
    void setAplicaciones(mejora.id, next);
  };

  return (
    <div>
      <form onSubmit={submit} className="mb-3 flex gap-1.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nueva mejora general…"
          aria-label="Nueva mejora general"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900"
        />
        <button
          type="submit"
          disabled={saving || !text.trim()}
          aria-label="Agregar mejora general"
          className="shrink-0 rounded-lg bg-emerald-600 px-2 py-1.5 text-white cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>

      {error ? <p className="mb-2 text-xs text-red-600">{error}</p> : null}

      {loading ? (
        <p className="py-4 text-center text-sm text-slate-500">Cargando...</p>
      ) : items.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-500">Ninguna mejora general.</p>
      ) : (
        <ul className="max-h-[min(420px,50vh)] space-y-1.5 overflow-y-auto pr-0.5">
          {items.map((mejora) => {
            const abierta = mejoraGeneralAbierta(mejora);
            const pickerOpen = pickerId === mejora.id;
            return (
              <li key={mejora.id} className="rounded-lg border border-slate-200 bg-white px-2 py-2">
                <div className="flex items-start gap-1">
                  <p className={`min-w-0 flex-1 text-sm font-medium ${abierta ? "text-slate-900" : "text-slate-500 line-through"}`}>
                    {mejora.text}
                  </p>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void remove(mejora.id)}
                    title="Eliminar mejora general"
                    aria-label="Eliminar mejora general"
                    className="shrink-0 rounded-md p-1 text-slate-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {mejora.aplicaciones.length > 0 ? (
                  <ul className="mt-1.5 space-y-1">
                    {mejora.aplicaciones.map((app) => (
                      <li key={`${mejora.id}-${etiquetaAplicacion(app)}`} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={saving}
                          aria-pressed={app.done}
                          aria-label={app.done ? `Desmarcar ${etiquetaAplicacion(app)}` : `Marcar hecha en ${etiquetaAplicacion(app)}`}
                          onClick={() => toggleHecho(mejora, app)}
                          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border cursor-pointer disabled:opacity-50 ${
                            app.done
                              ? "border-emerald-600 bg-emerald-600 text-white"
                              : "border-slate-300 bg-white text-transparent"
                          }`}
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectAplicacion?.(app)}
                          className={`min-w-0 flex-1 truncate text-left text-xs cursor-pointer ${
                            app.done ? "text-slate-400 line-through" : "text-slate-700"
                          }`}
                        >
                          {etiquetaAplicacion(app)}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-slate-400">Sin aplicaciones</p>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPickerQuery("");
                    setPickerId(pickerOpen ? null : mejora.id);
                  }}
                  className="mt-1.5 text-xs font-medium text-emerald-700 cursor-pointer"
                >
                  {pickerOpen ? "Cerrar" : "Aplicar a…"}
                </button>
                {pickerOpen ? (
                  aplicacionesDisponibles.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-400">No hay cuotas cargadas.</p>
                  ) : (
                    <AplicarMenu
                      query={pickerQuery}
                      onQueryChange={setPickerQuery}
                      apps={aplicacionesDisponibles}
                      assigned={mejora.aplicaciones}
                      saving={saving}
                      onToggle={(app) => toggleAsignada(mejora, app)}
                    />
                  )
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
