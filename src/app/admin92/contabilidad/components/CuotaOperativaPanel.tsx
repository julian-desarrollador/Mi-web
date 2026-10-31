"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  cobroRequiereEstadisticas,
  getCuotaOperativaBorder,
  getStatsObjectiveDate,
  getTaskFechaRealizada,
  getTaskSortDate,
  hasCambioPendiente,
  hasStatsPendientes,
  newSolicitudTaskId,
  normalizeSolicitudTask,
  sortSolicitudTasksByFecha,
  type ProyectoOperativo,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import CuotaCalendarDot from "@/app/admin92/contabilidad/components/CuotaCalendarDot";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { getCuotaEstado } from "@/app/admin92/contabilidad/lib/cuotaEstilos";
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
};

type Props = {
  cobro: CobroOperativo;
  proyecto: ProyectoOperativo | null;
  onCobroUpdated: () => void;
  onProyectoUpdated: () => void | Promise<void>;
  compact?: boolean;
};

export default function CuotaOperativaPanel({
  cobro,
  proyecto,
  onCobroUpdated,
  onProyectoUpdated,
  compact = false,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingStats, setPendingStats] = useState(false);
  const [statsFecha, setStatsFecha] = useState(todayYmd());
  const [tasks, setTasks] = useState<SolicitudTask[]>(cobro.solicitudTasks ?? []);
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(todayYmd());
  const [taskPendingDelete, setTaskPendingDelete] = useState<SolicitudTask | null>(null);
  const [pendingTaskComplete, setPendingTaskComplete] = useState<{
    taskId: string;
    text: string;
    fecha: string;
  } | null>(null);
  const editingTaskDateRef = useRef<string | null>(null);
  const editingCompletedDateRef = useRef<string | null>(null);
  const editingTaskTextRef = useRef<string | null>(null);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

  const taskDisplayDate = (t: SolicitudTask) => getTaskSortDate(t, cobro.dueDate);

  const taskDisplayFechaRealizada = (t: SolicitudTask) =>
    getTaskFechaRealizada(t) ?? todayYmd();

  const tasksSorted = useMemo(
    () => sortSolicitudTasksByFecha(tasks, cobro.dueDate),
    [tasks, cobro.dueDate],
  );

  const savedTaskDate = (taskId: string) => {
    const saved = cobro.solicitudTasks?.find((t) => t.id === taskId);
    return saved ? getTaskSortDate(saved, cobro.dueDate) : "";
  };

  const savedTaskFechaRealizada = (taskId: string) => {
    const saved = cobro.solicitudTasks?.find((t) => t.id === taskId);
    return saved ? getTaskFechaRealizada(saved) : null;
  };

  const savedTaskText = (taskId: string) =>
    cobro.solicitudTasks?.find((t) => t.id === taskId)?.text ?? "";

  useEffect(() => {
    if (
      editingTaskDateRef.current ||
      editingCompletedDateRef.current ||
      editingTaskTextRef.current
    ) {
      return;
    }
    setTasks(cobro.solicitudTasks ?? []);
  }, [cobro.id, cobro.solicitudTasks]);

  const today = todayYmd();
  const objetivoStats = getStatsObjectiveDate(cobro);
  const statsPendientes = hasStatsPendientes(cobro, proyecto, today);
  const cambioPendiente = hasCambioPendiente(cobro);
  const requiereStats = cobroRequiereEstadisticas(cobro, proyecto);
  const border = getCuotaOperativaBorder(cobro, proyecto, today);
  const estado = getCuotaEstado(cobro);

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

  const handleToggleCambioPendiente = async () => {
    await patchCobro({ cambioPendiente: !cambioPendiente });
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

  const saveTasks = async (nextTasks: SolicitudTask[]) => {
    const normalized = nextTasks.map((t) => normalizeSolicitudTask(t, cobro.dueDate));
    setTasks(normalized);
    await patchCobro({ solicitudTasks: normalized, cambioPendiente: true });
  };

  const handleToggleTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (task.done) {
      const next = tasks.map((t) =>
        t.id === taskId ? { ...t, done: false, fechaRealizada: undefined } : t,
      );
      setPendingTaskComplete(null);
      await saveTasks(next);
      return;
    }
    setPendingTaskComplete({
      taskId,
      text: task.text,
      fecha: todayYmd(),
    });
  };

  const handleConfirmTaskComplete = async () => {
    if (!pendingTaskComplete) return;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pendingTaskComplete.fecha)
      ? pendingTaskComplete.fecha
      : todayYmd();
    const next = tasks.map((t) =>
      t.id === pendingTaskComplete.taskId
        ? { ...t, done: true, fechaRealizada: fecha }
        : t,
    );
    setPendingTaskComplete(null);
    await saveTasks(next);
  };

  const handleRemoveTask = async (taskId: string) => {
    const next = tasks.filter((t) => t.id !== taskId);
    setTaskPendingDelete(null);
    await saveTasks(next);
  };

  const requestRemoveTask = (task: SolicitudTask) => {
    setTaskPendingDelete(task);
  };

  const handleRestoreTaskToColaActiva = async (taskId: string) => {
    const next = tasks.map((t) =>
      t.id === taskId ? { ...t, fueraColaActiva: false } : t,
    );
    await saveTasks(next);
  };

  const handleTaskDateLocalChange = (taskId: string, createdAt: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, createdAt } : t)),
    );
  };

  const handleTaskTextLocalChange = (taskId: string, text: string) => {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, text } : t)));
  };

  const commitTaskText = async (taskId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTasks(cobro.solicitudTasks ?? []);
      return;
    }
    if (savedTaskText(taskId) === trimmed) return;
    const next = tasksRef.current.map((t) =>
      t.id === taskId ? { ...t, text: trimmed } : t,
    );
    await saveTasks(next);
  };

  const commitTaskDate = async (taskId: string, createdAt: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) {
      setTasks(cobro.solicitudTasks ?? []);
      return;
    }
    if (savedTaskDate(taskId) === createdAt) return;
    const next = tasksRef.current.map((t) =>
      t.id === taskId ? { ...t, createdAt } : t,
    );
    await saveTasks(next);
  };

  const handleTaskFechaRealizadaLocalChange = (taskId: string, fechaRealizada: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, fechaRealizada } : t)),
    );
  };

  const commitTaskFechaRealizada = async (taskId: string, fechaRealizada: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRealizada)) {
      setTasks(cobro.solicitudTasks ?? []);
      return;
    }
    if (savedTaskFechaRealizada(taskId) === fechaRealizada) return;
    const next = tasksRef.current.map((t) =>
      t.id === taskId ? { ...t, fechaRealizada } : t,
    );
    await saveTasks(next);
  };

  const handleAddTask = async () => {
    const text = newTaskText.trim();
    if (!text) return;
    const next = [
      ...tasks,
      {
        id: newSolicitudTaskId(),
        text,
        done: false,
        createdAt: /^\d{4}-\d{2}-\d{2}$/.test(newTaskDate) ? newTaskDate : todayYmd(),
      },
    ];
    setNewTaskText("");
    setNewTaskDate(todayYmd());
    await saveTasks(next);
  };

  const boxClass = compact
    ? "mt-2 rounded-lg border-2 border-slate-200 bg-white p-3 space-y-3"
    : "rounded-lg border-2 border-slate-200 bg-white p-3 space-y-3 shadow-sm";

  return (
    <div className={boxClass}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cola operativa
        </p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400">Vista calendario:</span>
          <CuotaCalendarDot estado={estado} border={border} size="md" />
        </div>
      </div>

      {/* {!proyecto && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          Sin proyecto para <strong>{cobro.clientName}</strong>. Al marcar un checkbox se crea
          automáticamente, o creá uno en Proyectos.
        </p>
      )} */}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={requiereStats}
            disabled={saving}
            onChange={handleToggleRequiereStats}
            className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500 cursor-pointer"
          />
          <span className={requiereStats ? "font-medium text-violet-800" : ""}>
            Requiere estadísticas
          </span>
          {requiereStats && (
            <span className="text-[10px] rounded-full border border-dashed border-violet-400 text-violet-700 px-1.5 py-0.5">
              borde violeta
            </span>
          )}
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={cambioPendiente}
            disabled={saving}
            onChange={handleToggleCambioPendiente}
            className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
          />
          <span className={cambioPendiente ? "font-medium text-amber-800" : ""}>
            Cambio pendiente
          </span>
          {cambioPendiente && (
            <span className="text-[10px] rounded-full border border-dashed border-amber-400 text-amber-700 px-1.5 py-0.5">
              borde ámbar
            </span>
          )}
        </label>
      </div>

      {requiereStats && (
        <div className="flex flex-wrap items-center gap-2 text-xs border-t border-slate-100 pt-2">
          {cobro.paid ? (
            <>
              <span className="text-slate-600">
                Enviar antes de:{" "}
                <strong>{objetivoStats ? formatLocalDate(objetivoStats) : "—"}</strong>
              </span>
              {cobro.estadisticasEnviadas && cobro.fechaEnvioEstadisticas ? (
                <span className="text-green-700 font-medium">
                  Enviadas el {formatLocalDate(cobro.fechaEnvioEstadisticas)}
                </span>
              ) : statsPendientes ? (
                <span className="font-medium text-violet-700">Pendientes (borde activo)</span>
              ) : null}
              <button
                type="button"
                disabled={saving}
                onClick={handleStatsClick}
                className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 font-medium transition-colors cursor-pointer disabled:opacity-50 ${
                  cobro.estadisticasEnviadas
                    ? "border-violet-300 bg-violet-50 text-violet-800"
                    : "border-slate-300 bg-white text-slate-600"
                }`}
              >
                {cobro.estadisticasEnviadas ? <Check className="h-3 w-3" /> : null}
                {cobro.estadisticasEnviadas ? "Quitar envío" : "Marcar enviadas"}
              </button>
              {cobro.estadisticasEnviadas && cobro.fechaEnvioEstadisticas && (
                <DatePickerField
                  value={cobro.fechaEnvioEstadisticas}
                  disabled={saving}
                  onChange={(ymd) => patchCobro({ fechaEnvioEstadisticas: ymd })}
                  title="Fecha de envío de estadísticas"
                  aria-label="Fecha de envío de estadísticas"
                  className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                />
              )}
            </>
          ) : (
            <span className="text-slate-500">
              El borde violeta aparece al marcar la cuota como pagada.
            </span>
          )}
        </div>
      )}

      {pendingStats && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-violet-200 bg-violet-50/60 p-2">
          <label className="text-xs text-slate-700">
            Fecha de envío
            <DatePickerField
              value={statsFecha}
              onChange={setStatsFecha}
              className="mt-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={handleConfirmStats}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setPendingStats(false)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      {(cambioPendiente || tasks.length > 0) && (
        <div className="border-t border-slate-100 pt-2">
          <p className="text-xs font-medium text-slate-700 mb-1.5">Tareas del cambio</p>
          <ul className="space-y-1.5">
            {tasksSorted.map((t) => (
              <li
                key={t.id}
                className={`flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 -mx-1 ${
                  t.fueraColaActiva ? "bg-slate-50/80" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={t.done}
                  disabled={saving}
                  onChange={() => handleToggleTask(t.id)}
                  className="rounded border-slate-300 text-amber-600 cursor-pointer shrink-0"
                />
                <span className="min-w-0 flex-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <input
                    type="text"
                    value={t.text}
                    disabled={saving}
                    onFocus={() => {
                      editingTaskTextRef.current = t.id;
                    }}
                    onChange={(e) => handleTaskTextLocalChange(t.id, e.target.value)}
                    onBlur={(e) => {
                      editingTaskTextRef.current = null;
                      void commitTaskText(t.id, e.target.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        e.currentTarget.blur();
                      }
                    }}
                    title="Texto de la tarea"
                    aria-label="Texto de la tarea"
                    className={`min-w-[120px] flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-slate-300 focus:bg-white disabled:opacity-50 ${
                      t.done ? "text-slate-400 line-through" : "text-slate-800"
                    } ${t.fueraColaActiva ? "text-slate-500" : ""}`}
                  />
                  {t.fueraColaActiva && (
                    <span className="text-[10px] font-normal text-slate-400 shrink-0">
                      · solo historial
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-[10px] text-slate-400 w-7 text-right">Ped.</span>
                  <DatePickerField
                    value={taskDisplayDate(t)}
                    disabled={saving}
                    onFocus={() => {
                      editingTaskDateRef.current = t.id;
                    }}
                    onChange={(ymd) => handleTaskDateLocalChange(t.id, ymd)}
                    onBlur={(ymd) => {
                      editingTaskDateRef.current = null;
                      void commitTaskDate(t.id, ymd);
                    }}
                    title="Fecha pedido"
                    aria-label="Fecha pedido"
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                  />
                </span>
                {t.done ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-[10px] text-slate-400 w-12 text-right">
                      Entregado
                    </span>
                    <DatePickerField
                      value={taskDisplayFechaRealizada(t)}
                      disabled={saving}
                      onFocus={() => {
                        editingCompletedDateRef.current = t.id;
                      }}
                      onChange={(ymd) =>
                        handleTaskFechaRealizadaLocalChange(t.id, ymd)
                      }
                      onBlur={(ymd) => {
                        editingCompletedDateRef.current = null;
                        void commitTaskFechaRealizada(t.id, ymd);
                      }}
                      title="Fecha entregado"
                      aria-label="Fecha entregado"
                      className="rounded border border-green-200 bg-green-50 px-2 py-1 text-sm text-green-800"
                    />
                  </span>
                ) : null}
                {t.fueraColaActiva ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleRestoreTaskToColaActiva(t.id)}
                    title="Volver a mostrar en Cambios pendientes"
                    className="shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 cursor-pointer disabled:opacity-50"
                  >
                    Subir
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => requestRemoveTask(t)}
                  className="shrink-0 p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                  aria-label="Eliminar tarea"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>

          {pendingTaskComplete && (
            <div className="mt-2 flex flex-wrap items-end gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-amber-900 mb-1">Marcar tarea entregada</p>
                <p className="text-xs text-slate-700 line-clamp-2">{pendingTaskComplete.text}</p>
              </div>
              <label className="text-xs text-slate-700">
                Fecha entregado
                <DatePickerField
                  value={pendingTaskComplete.fecha}
                  onChange={(ymd) =>
                    setPendingTaskComplete((prev) =>
                      prev ? { ...prev, fecha: ymd } : prev,
                    )
                  }
                  className="mt-1 rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700"
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleConfirmTaskComplete()}
                className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
              >
                Confirmar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setPendingTaskComplete(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-2">
            <input
              type="text"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddTask();
                }
              }}
              placeholder="Nueva tarea…"
              disabled={saving}
              className="min-w-[120px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
            />
            <DatePickerField
              value={newTaskDate}
              disabled={saving}
              onChange={setNewTaskDate}
              title="Fecha pedido de la nueva tarea"
              className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            />
            <button
              type="button"
              disabled={saving || !newTaskText.trim()}
              onClick={handleAddTask}
              className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saving && <p className="text-xs text-slate-400">Guardando…</p>}

      {taskPendingDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-task-title"
          onClick={() => !saving && setTaskPendingDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="confirm-delete-task-title"
              className="text-sm font-semibold text-slate-900 mb-2"
            >
              ¿Eliminar esta tarea?
            </h3>
            <p className="text-sm text-slate-700 mb-1 line-clamp-3">{taskPendingDelete.text}</p>
            <p className="text-xs text-slate-500 mb-1">
              Pedido: {formatLocalDate(taskDisplayDate(taskPendingDelete))}
            </p>
            <p className="text-xs text-slate-500 mb-4">
              Se elimina de Cola operativa y del historial de la cuota.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => setTaskPendingDelete(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleRemoveTask(taskPendingDelete.id)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white cursor-pointer disabled:opacity-50"
              >
                {saving ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
