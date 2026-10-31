"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, Plus, Trash2, Wrench } from "lucide-react";
import {
  cobroRequiereEstadisticas,
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
    ? "mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white"
    : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm";

  const pendingCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - pendingCount;
  const statsEnviadas = Boolean(cobro.estadisticasEnviadas);
  /** Fecha chica, sin caja: se ve como texto y se edita al tocarla. */
  const inlineDateClass =
    "rounded px-1 py-0.5 text-xs font-medium border border-transparent hover:border-slate-200 hover:bg-white";

  return (
    <div className={boxClass}>
      {/* Qué requiere esta cuota: dos interruptores claros */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-pressed={cambioPendiente}
          disabled={saving}
          onClick={handleToggleCambioPendiente}
          title={cambioPendiente ? "Quitar cambio pendiente" : "Marcar que tiene un cambio pendiente"}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
            cambioPendiente
              ? "border-amber-300 bg-amber-50 text-amber-800"
              : "border-slate-200 bg-white text-slate-500"
          }`}
        >
          <Wrench className="h-3.5 w-3.5" />
          Cambio pendiente
          {cambioPendiente && pendingCount > 0 ? (
            <span className="rounded-full bg-amber-200/70 px-1.5 text-[10px] font-bold text-amber-900">
              {pendingCount}
            </span>
          ) : null}
        </button>
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

      {/* Tareas del cambio: lista tipo checklist, fechas como texto debajo */}
      {(cambioPendiente || tasks.length > 0) && (
        <div className="border-t border-slate-100 px-3 py-2.5">
          <div className="mb-1.5 flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tareas del cambio
            </p>
            {tasks.length > 0 ? (
              <p className="text-xs text-slate-500">
                {pendingCount > 0 ? (
                  <span className="font-semibold text-amber-700">
                    {pendingCount} {pendingCount === 1 ? "pendiente" : "pendientes"}
                  </span>
                ) : (
                  <span className="font-semibold text-green-700">Todo entregado</span>
                )}
                {doneCount > 0 && pendingCount > 0
                  ? ` · ${doneCount} ${doneCount === 1 ? "entregada" : "entregadas"}`
                  : ""}
              </p>
            ) : null}
          </div>

          {tasks.length === 0 ? (
            <p className="py-1 text-sm text-slate-400">Todavía no cargaste qué pidió.</p>
          ) : (
            <ul className="-mx-1.5">
              {tasksSorted.map((t) => (
                <li
                  key={t.id}
                  className={`group flex items-start gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-slate-50 ${
                    t.fueraColaActiva ? "opacity-70" : ""
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={t.done}
                    disabled={saving}
                    onChange={() => handleToggleTask(t.id)}
                    aria-label={t.done ? "Marcar pendiente" : "Marcar entregada"}
                    className="mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 text-amber-600 cursor-pointer"
                  />
                  <div className="min-w-0 flex-1">
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
                      className={`w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-slate-300 focus:bg-white disabled:opacity-50 ${
                        t.done ? "text-slate-400 line-through" : "font-medium text-slate-900"
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-1 text-xs text-slate-500">
                      <span className="inline-flex items-center">
                        Pedida
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
                          title="Fecha en que la pidió"
                          aria-label="Fecha en que la pidió"
                          className={`${inlineDateClass} text-slate-600`}
                        />
                      </span>
                      {t.done ? (
                        <span className="inline-flex items-center text-green-700">
                          Entregada
                          <DatePickerField
                            value={taskDisplayFechaRealizada(t)}
                            disabled={saving}
                            onFocus={() => {
                              editingCompletedDateRef.current = t.id;
                            }}
                            onChange={(ymd) => handleTaskFechaRealizadaLocalChange(t.id, ymd)}
                            onBlur={(ymd) => {
                              editingCompletedDateRef.current = null;
                              void commitTaskFechaRealizada(t.id, ymd);
                            }}
                            title="Fecha de entrega"
                            aria-label="Fecha de entrega"
                            className={`${inlineDateClass} text-green-700`}
                          />
                        </span>
                      ) : null}
                      {t.fueraColaActiva ? (
                        <span className="inline-flex items-center gap-1.5 text-slate-400">
                          Fuera de la cola
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void handleRestoreTaskToColaActiva(t.id)}
                            title="Volver a mostrar en Cambios pendientes"
                            className="font-semibold text-[#4a7fb8] cursor-pointer disabled:opacity-50"
                          >
                            Volver a la cola
                          </button>
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => requestRemoveTask(t)}
                    className="mt-1 shrink-0 rounded p-1 text-slate-300 opacity-0 transition-opacity hover:text-red-600 focus:opacity-100 group-hover:opacity-100 cursor-pointer"
                    aria-label="Eliminar tarea"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {pendingTaskComplete && (
            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
              <p className="text-xs font-semibold text-amber-900">¿Cuándo la entregaste?</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-700">{pendingTaskComplete.text}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DatePickerField
                  value={pendingTaskComplete.fecha}
                  onChange={(ymd) =>
                    setPendingTaskComplete((prev) => (prev ? { ...prev, fecha: ymd } : prev))
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                />
                <span className="flex-1" />
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setPendingTaskComplete(null)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleConfirmTaskComplete()}
                  className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                >
                  Marcar entregada
                </button>
              </div>
            </div>
          )}

          {/* Agregar tarea: una sola línea, la fecha queda chica a la derecha */}
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2 py-1">
            <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
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
              placeholder="Agregar algo que pidió…"
              disabled={saving}
              aria-label="Nueva tarea del cambio"
              className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
            <DatePickerField
              value={newTaskDate}
              disabled={saving}
              onChange={setNewTaskDate}
              title="Fecha en que la pidió"
              aria-label="Fecha en que la pidió"
              className={`${inlineDateClass} shrink-0 text-slate-500`}
            />
            {newTaskText.trim() ? (
              <button
                type="button"
                disabled={saving}
                onClick={handleAddTask}
                className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                Agregar
              </button>
            ) : null}
          </div>
        </div>
      )}

      {error && <p className="border-t border-slate-100 px-3 py-2 text-xs text-red-600">{error}</p>}

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
