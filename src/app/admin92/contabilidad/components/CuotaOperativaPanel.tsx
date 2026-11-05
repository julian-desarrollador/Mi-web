"use client";

import { useEffect, useState } from "react";
import { BarChart3, Check, Sparkles, Wrench } from "lucide-react";
import {
  CUOTA_TASK_FIELDS,
  cobroRequiereEstadisticas,
  getStatsObjectiveDate,
  hasCambioPendiente,
  hasMejorasPendientes,
  hasStatsPendientes,
  type CuotaTaskKind,
  type ProyectoOperativo,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import CuotaTareasSection from "@/app/admin92/contabilidad/components/CuotaTareasSection";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { formatLocalDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type CobroOperativo = {
  id: string;
  clientName: string;
  paid: boolean;
  fechaCobro?: string;
  dueDate: string;
  recordatorioEnviado?: boolean;
  estadisticasEnviadas?: boolean;
  fechaEnvioEstadisticas?: string;
  requiereEstadisticas?: boolean;
  servicio?: string;
  cambioPendiente?: boolean;
  solicitudTasks?: SolicitudTask[];
  mejoraPendiente?: boolean;
  mejorasPendientes?: SolicitudTask[];
};

type Props = {
  cobro: CobroOperativo;
  proyecto: ProyectoOperativo | null;
  onCobroUpdated: () => void;
  onProyectoUpdated: () => void | Promise<void>;
  compact?: boolean;
  /** Abrir esta pestaña (al elegir la cuota desde la columna lateral) */
  tabHint?: CuotaTaskKind;
};

const TABS = {
  cambio: {
    label: "Cambios pendientes",
    Icon: Wrench,
    active: "border-amber-500 bg-amber-500 text-white",
    flagged: "border-amber-300 bg-amber-50 text-amber-800",
    badge: "bg-amber-200/70 text-amber-900",
  },
  mejora: {
    label: "Mejoras",
    Icon: Sparkles,
    active: "border-cyan-600 bg-cyan-600 text-white",
    flagged: "border-cyan-300 bg-cyan-50 text-cyan-800",
    badge: "bg-cyan-200/70 text-cyan-900",
  },
} as const;

const TAB_KINDS: CuotaTaskKind[] = ["cambio", "mejora"];

export default function CuotaOperativaPanel({
  cobro,
  proyecto,
  onCobroUpdated,
  onProyectoUpdated,
  compact = false,
  tabHint,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingStats, setPendingStats] = useState(false);
  const [statsFecha, setStatsFecha] = useState(todayYmd());
  const [tab, setTab] = useState<CuotaTaskKind>(tabHint ?? "cambio");

  useEffect(() => {
    if (tabHint) setTab(tabHint);
  }, [tabHint]);

  const today = todayYmd();
  const objetivoStats = getStatsObjectiveDate(cobro);
  const statsPendientes = hasStatsPendientes(cobro, proyecto, today);
  const requiereStats = cobroRequiereEstadisticas(cobro, proyecto);
  const flags: Record<CuotaTaskKind, boolean> = {
    cambio: hasCambioPendiente(cobro),
    mejora: hasMejorasPendientes(cobro),
  };

  const patchCobro = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cobros/${cobro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar la cuota.");
      onCobroUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setSaving(false);
    }
  };

  const patchProyecto = async (proyectoId: string, body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/proyectos/${proyectoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar el proyecto.");
      await onProyectoUpdated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setSaving(false);
    }
  };

  /** Crea proyecto mínimo si no hay uno vinculado al cliente */
  const ensureProyecto = async (): Promise<string | null> => {
    if (proyecto?.id) return proyecto.id;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cobro.clientName.trim(),
          clientName: cobro.clientName.trim(),
          type: cobro.servicio || "Web",
          fechaInicio: todayYmd(),
          status: "en_produccion",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo crear el proyecto.");
      }
      await onProyectoUpdated();
      return data.id as string;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al vincular proyecto.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const updateProyectoField = async (body: Record<string, unknown>) => {
    let id = proyecto?.id;
    if (!id) {
      id = (await ensureProyecto()) ?? undefined;
    }
    if (!id) return;
    await patchProyecto(id, body);
  };

  const handleToggleRequiereStats = async () => {
    await patchCobro({ requiereEstadisticas: !requiereStats });
  };

  const handleStatsClick = async () => {
    if (!requiereStats) return;
    if (cobro.estadisticasEnviadas) {
      await patchCobro({ estadisticasEnviadas: false });
      setPendingStats(false);
      return;
    }
    setStatsFecha(todayYmd());
    setPendingStats(true);
  };

  const handleConfirmStats = async () => {
    await patchCobro({
      estadisticasEnviadas: true,
      fechaEnvioEstadisticas: statsFecha,
    });
    setPendingStats(false);
  };

  const boxClass = compact
    ? "mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"
    : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

  const statsEnviadas = Boolean(cobro.estadisticasEnviadas);
  /** Fecha chica, sin caja: se ve como texto y se edita al tocarla. */
  const inlineDateClass =
    "rounded px-1 py-0.5 text-xs font-medium border border-transparent hover:border-slate-200 hover:bg-white";

  return (
    <div className={boxClass}>
      {/* Pestañas de la cuota + interruptor de estadísticas */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <div role="tablist" aria-label="Pendientes de la cuota" className="flex flex-wrap gap-2">
          {TAB_KINDS.map((kind) => {
            const t = TABS[kind];
            const isActive = tab === kind;
            const pending = (cobro[CUOTA_TASK_FIELDS[kind].tasks] ?? []).filter((x) => !x.done).length;
            return (
              <button
                key={kind}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(kind)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? t.active
                    : flags[kind]
                      ? t.flagged
                      : "border-slate-200 bg-white text-slate-500"
                }`}
              >
                <t.Icon className="h-3.5 w-3.5" />
                {t.label}
                {pending > 0 ? (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      isActive ? "bg-white/25 text-white" : t.badge
                    }`}
                  >
                    {pending}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          aria-pressed={requiereStats}
          disabled={saving}
          onClick={handleToggleRequiereStats}
          title={requiereStats ? "No requiere estadísticas" : "Requiere estadísticas mensuales"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
            requiereStats
              ? "border-violet-300 bg-violet-50 text-violet-800"
              : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Estadísticas
        </button>
        {saving ? <span className="ml-auto text-xs text-slate-400">Guardando…</span> : null}
      </div>

      {/* Estadísticas: estado en una línea + acción */}
      {requiereStats && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-slate-100 bg-violet-50/30 px-3 py-2.5">
          <BarChart3 className="h-4 w-4 shrink-0 text-violet-500" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            {!cobro.paid ? (
              <span className="text-slate-500">Se habilitan cuando la cuota esté pagada.</span>
            ) : statsEnviadas ? (
              <span className="inline-flex flex-wrap items-center gap-1 font-medium text-green-700">
                <Check className="h-3.5 w-3.5" />
                Enviadas el
                {cobro.fechaEnvioEstadisticas ? (
                  <DatePickerField
                    value={cobro.fechaEnvioEstadisticas}
                    disabled={saving}
                    onChange={(ymd) => patchCobro({ fechaEnvioEstadisticas: ymd })}
                    title="Fecha de envío de estadísticas"
                    aria-label="Fecha de envío de estadísticas"
                    className={`${inlineDateClass} text-green-700`}
                  />
                ) : (
                  " —"
                )}
              </span>
            ) : (
              <span className="text-slate-700">
                {statsPendientes ? (
                  <span className="mr-1.5 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                    Pendientes
                  </span>
                ) : null}
                Enviar antes del{" "}
                <strong className="font-semibold text-slate-900">
                  {objetivoStats ? formatLocalDate(objetivoStats) : "—"}
                </strong>
              </span>
            )}
          </div>
          {cobro.paid && !pendingStats ? (
            <button
              type="button"
              disabled={saving}
              onClick={handleStatsClick}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50 ${
                statsEnviadas
                  ? "border border-slate-200 bg-white text-slate-600"
                  : "bg-violet-600 text-white"
              }`}
            >
              {statsEnviadas ? "Deshacer envío" : "Marcar enviadas"}
            </button>
          ) : null}
        </div>
      )}

      {pendingStats && (
        <div className="flex flex-wrap items-center gap-2 border-t border-violet-100 bg-violet-50/60 px-3 py-2.5">
          <span className="text-xs font-medium text-violet-900">Enviadas el</span>
          <DatePickerField
            value={statsFecha}
            onChange={setStatsFecha}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          />
          <span className="flex-1" />
          <button
            type="button"
            disabled={saving}
            onClick={() => setPendingStats(false)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmStats}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            Confirmar
          </button>
        </div>
      )}

      <CuotaTareasSection
        key={tab}
        kind={tab}
        cobroId={cobro.id}
        dueDate={cobro.dueDate}
        savedTasks={cobro[CUOTA_TASK_FIELDS[tab].tasks]}
        flag={flags[tab]}
        saving={saving}
        onPatch={patchCobro}
      />

      {error && <p className="border-t border-slate-100 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
