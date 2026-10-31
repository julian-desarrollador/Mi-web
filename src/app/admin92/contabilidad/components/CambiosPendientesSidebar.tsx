"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ListMinus } from "lucide-react";
import {
  sortCuotasCambiosPendientes,
  type CambioTaskListItem,
  type CambiosSortMode,
  type CuotaCambioItem,
  type MesCambiosAtrasados,
} from "@/app/admin92/contabilidad/lib/cambiosPendientes";
import { formatLocalDate, formatMonthLabel } from "@/app/admin92/contabilidad/lib/utils";
import CuotaCalendarDot from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import SaasTareasPanel from "@/app/admin92/contabilidad/components/SaasTareasPanel";

type Props = {
  cuotas: CuotaCambioItem[];
  tareas?: CambioTaskListItem[];
  mesesAtrasados?: MesCambiosAtrasados[];
  onGoToMesAtrasado?: (monthKey: string) => void;
  labelFor: (c: CuotaCambioItem) => string;
  selectedCobroId: string | null;
  selectedDesarrolloId?: string | null;
  sortMode: CambiosSortMode;
  onSortModeChange: (mode: CambiosSortMode) => void;
  onSelectCuota: (c: CuotaCambioItem) => void;
  onPrioridadChange: (cobroId: string, prioridad: number | undefined) => void;
  onDismissTaskFromColaActiva?: (cobroId: string, taskId: string) => void;
  /** En mobile: panel colapsable */
  collapsible?: boolean;
  className?: string;
};

type PrioridadInputProps = {
  cobroId: string;
  prioridad: number | undefined;
  onPrioridadChange: (cobroId: string, prioridad: number | undefined) => void;
};

function PrioridadInput({ cobroId, prioridad, onPrioridadChange }: PrioridadInputProps) {
  const [local, setLocal] = useState<string>(() =>
    prioridad !== undefined ? String(prioridad) : "",
  );

  useEffect(() => {
    setLocal(prioridad !== undefined ? String(prioridad) : "");
  }, [cobroId, prioridad]);

  const commit = (next: number | undefined) => {
    setLocal(next !== undefined ? String(next) : "");
    onPrioridadChange(cobroId, next);
  };

  const step = (delta: number) => {
    const current =
      local === "" ? (delta < 0 ? 1 : 0) : Math.max(0, parseInt(local, 10) || 0);
    const next = Math.max(0, current + delta);
    commit(next);
  };

  return (
    <div className="flex shrink-0 overflow-hidden rounded-md border border-slate-300 bg-white shadow-sm">
      <input
        type="number"
        min={0}
        step={1}
        value={local}
        placeholder="—"
        title="Prioridad (0 = más urgente)"
        onChange={(e) => setLocal(e.target.value)}
        onBlur={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") {
            if (prioridad !== undefined) commit(undefined);
            else setLocal("");
            return;
          }
          const n = parseInt(raw, 10);
          if (!Number.isNaN(n) && n >= 0) {
            if (n !== prioridad) commit(n);
            else setLocal(String(n));
          } else {
            setLocal(prioridad !== undefined ? String(prioridad) : "");
          }
        }}
        className="w-8 border-0 bg-transparent py-1 text-center text-xs font-medium text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <div className="flex flex-col border-l border-slate-200">
        <button
          type="button"
          aria-label="Aumentar urgencia (número menor)"
          onClick={() => step(-1)}
          className="flex h-[15px] w-[18px] items-center justify-center text-[#4a7fb8] active:bg-[#84b9ed]/30 cursor-pointer"
        >
          <ChevronUp className="h-3 w-3 stroke-[2.5]" />
        </button>
        <button
          type="button"
          aria-label="Disminuir urgencia (número mayor)"
          onClick={() => step(1)}
          className="flex h-[15px] w-[18px] items-center justify-center border-t border-slate-200 text-[#4a7fb8] active:bg-[#84b9ed]/30 cursor-pointer"
        >
          <ChevronDown className="h-3 w-3 stroke-[2.5]" />
        </button>
      </div>
    </div>
  );
}

export default function CambiosPendientesSidebar({
  cuotas,
  tareas = [],
  mesesAtrasados = [],
  onGoToMesAtrasado,
  labelFor,
  selectedCobroId,
  selectedDesarrolloId = null,
  sortMode,
  onSortModeChange,
  onSelectCuota,
  onPrioridadChange,
  onDismissTaskFromColaActiva,
  collapsible = false,
  className = "",
}: Props) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mesesAtrasadosOpen, setMesesAtrasadosOpen] = useState(false);
  const [saasPendingCount, setSaasPendingCount] = useState(0);
  const sorted = sortCuotasCambiosPendientes(cuotas, sortMode);
  const atrasadosCount = mesesAtrasados.reduce((sum, m) => sum + m.count, 0);
  const listCount =
    sortMode === "saas"
      ? saasPendingCount
      : sortMode === "tareas"
        ? tareas.length
        : cuotas.length;
  const panelTitle = sortMode === "saas" ? "SaaS" : "Cambios pendientes";

  const taskClientLabel = (t: CambioTaskListItem) =>
    t.source === "desarrollo50"
      ? `${t.clientName} — ${t.servicio || "Desarrollo"} · 50%`
      : t.servicio
        ? `${t.clientName} (${t.servicio})`
        : t.clientName;

  useEffect(() => {
    if (mesesAtrasados.length === 0) setMesesAtrasadosOpen(false);
  }, [mesesAtrasados.length]);

  const content = (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {panelTitle}
          <span className="ml-1.5 font-normal normal-case text-slate-400">({listCount})</span>
        </p>
        <div className="flex flex-wrap rounded-lg border border-slate-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => onSortModeChange("fecha")}
            className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
              sortMode === "fecha" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Fecha
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("prioridad")}
            className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
              sortMode === "prioridad" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Prioridad
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("tareas")}
            className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
              sortMode === "tareas" ? "bg-slate-900 text-white" : "text-slate-600"
            }`}
          >
            Tareas
          </button>
          <button
            type="button"
            onClick={() => onSortModeChange("saas")}
            className={`rounded-md px-2 py-1 font-medium cursor-pointer ${
              sortMode === "saas" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            SaaS
          </button>
        </div>
      </div>

      {sortMode === "saas" ? (
        <SaasTareasPanel onCountChange={setSaasPendingCount} />
      ) : sortMode === "tareas" ? (
        tareas.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">
            Ninguna tarea en cola activa este mes.
          </p>
        ) : (
          <ul className="space-y-1.5 max-h-[min(420px,50vh)] overflow-y-auto pr-0.5">
            {tareas.map((t) => {
              const isSelected =
                t.source === "desarrollo50"
                  ? selectedDesarrolloId === t.cobroId
                  : selectedCobroId === t.cobroId;
              return (
                <li key={`${t.source ?? "cobro"}-${t.taskId}`}>
                  <div
                    className={`flex w-full items-start gap-1 rounded-lg border px-2 py-2 transition-colors ${
                      isSelected
                        ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300/60"
                        : "border-slate-200 bg-white hover:border-amber-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onSelectCuota({
                          id: t.cobroId,
                          clientName: t.clientName,
                          dueDate: t.dueDate,
                          servicio: t.servicio,
                          estado: t.estado,
                          border: t.border,
                          source: t.source,
                        })
                      }
                      className="min-w-0 flex-1 flex items-start gap-2 text-left cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#84b9ed]/50"
                    >
                      <CuotaCalendarDot estado={t.estado} border={t.border} size="md" />
                      <span className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium text-slate-900 ${
                            t.done ? "line-through text-slate-500" : ""
                          }`}
                        >
                          {t.text}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {taskClientLabel(t)}
                          {t.done && t.fechaRealizada
                            ? ` · Ped. ${formatLocalDate(t.fecha)} · Real. ${formatLocalDate(t.fechaRealizada)}`
                            : ` · Ped. ${formatLocalDate(t.fecha)}`}
                        </p>
                      </span>
                    </button>
                    {onDismissTaskFromColaActiva && (
                      <button
                        type="button"
                        onClick={() => onDismissTaskFromColaActiva(t.cobroId, t.taskId)}
                        title="Quitar de cola activa (queda en Cola operativa)"
                        aria-label="Quitar de cola activa"
                        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                      >
                        <ListMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : sorted.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          Ninguna cuota ni desarrollo con cambio pendiente.
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-[min(420px,50vh)] overflow-y-auto pr-0.5">
          {sorted.map((c) => {
            const isSelected =
              c.source === "desarrollo50"
                ? selectedDesarrolloId === c.id
                : selectedCobroId === c.id;
            return (
              <li key={`${c.source ?? "cobro"}-${c.id}`}>
                <div
                  className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 transition-colors ${
                    isSelected
                      ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300/60"
                      : "border-slate-200 bg-white hover:border-amber-200"
                  }`}
                >
                  {c.source === "desarrollo50" ? (
                    <span className="w-[52px] shrink-0" aria-hidden />
                  ) : (
                    <PrioridadInput
                      cobroId={c.id}
                      prioridad={c.prioridad}
                      onPrioridadChange={onPrioridadChange}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => onSelectCuota(c)}
                    className="min-w-0 flex-1 flex items-start gap-2 text-left cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#84b9ed]/50"
                  >
                    <CuotaCalendarDot estado={c.estado} border={c.border} size="md" />
                    <span className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{labelFor(c)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {c.source === "desarrollo50"
                          ? `Cambio desde ${formatLocalDate(c.dueDate)}`
                          : `Vence ${formatLocalDate(c.dueDate)}`}
                      </p>
                    </span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {sortMode !== "saas" && atrasadosCount > 0 && onGoToMesAtrasado && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setMesesAtrasadosOpen((v) => !v)}
            aria-expanded={mesesAtrasadosOpen}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm font-medium text-amber-900 hover:border-amber-300 cursor-pointer transition-colors"
          >
            <span>
              {atrasadosCount} atrasado{atrasadosCount !== 1 ? "s" : ""}
            </span>
            {mesesAtrasadosOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-amber-700" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-amber-700" />
            )}
          </button>
          {mesesAtrasadosOpen && (
            <ul className="mt-1.5 space-y-1 rounded-lg border border-amber-100 bg-amber-50/30 p-1.5">
              {mesesAtrasados.map(({ monthKey }) => (
                <li key={monthKey}>
                  <button
                    type="button"
                    onClick={() => {
                      onGoToMesAtrasado(monthKey);
                      setMesesAtrasadosOpen(false);
                    }}
                    className="w-full rounded-md px-2.5 py-2 text-left text-sm font-medium text-amber-900 cursor-pointer transition-colors"
                  >
                    {formatMonthLabel(monthKey)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {sortMode !== "saas" && sorted.length > 0 && sortMode === "prioridad" && (
        <p className="mt-2 text-[10px] text-slate-400">
          Prioridad: número menor = más urgente (solo al ordenar por Prioridad).
        </p>
      )}
    </>
  );

  if (collapsible) {
    return (
      <div
        data-cambios-sidebar
        className={`rounded-2xl border border-slate-200 bg-white lg:hidden ${className}`}
      >
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left cursor-pointer"
        >
          <span className="text-sm font-semibold text-slate-900">
            {sortMode === "saas" ? "SaaS" : "Cambios pendientes"}
            {sortMode === "saas" ? (
              saasPendingCount > 0 && (
                <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                  {saasPendingCount}
                </span>
              )
            ) : (
              <>
                {cuotas.length > 0 && (
                  <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    {cuotas.length}
                  </span>
                )}
                {atrasadosCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-800">
                    +{atrasadosCount} atr.
                  </span>
                )}
              </>
            )}
          </span>
          {mobileOpen ? (
            <ChevronUp className="h-4 w-4 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
          )}
        </button>
        {mobileOpen && <div className="border-t border-slate-100 px-4 pb-4 pt-2">{content}</div>}
      </div>
    );
  }

  return (
    <aside
      data-cambios-sidebar
      className={`rounded-2xl border border-slate-200 bg-white p-4 sticky top-24 ${className}`}
    >
      {content}
    </aside>
  );
}
