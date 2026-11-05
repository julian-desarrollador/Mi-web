"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  CUOTA_TASK_FIELDS,
  getTaskFechaRealizada,
  getTaskSortDate,
  newSolicitudTaskId,
  normalizeSolicitudTask,
  sortSolicitudTasksByFecha,
  type CuotaTaskKind,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { formatLocalDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";

/** Cambios y mejoras funcionan igual: solo cambian los textos y el color. */
const VARIANTS = {
  cambio: {
    flagOffTitle: "Marcar la cuota con borde ámbar",
    flagOnTitle: "Quitar el borde ámbar de la cuota",
    listTitle: "Tareas del cambio",
    empty: "Todavía no cargaste qué pidió.",
    placeholder: "Agregar algo que pidió…",
    newAria: "Nueva tarea del cambio",
    createdLabel: "Pedida",
    createdTitle: "Fecha en que la pidió",
    deleteTitle: "¿Eliminar esta tarea?",
    switchOn: "bg-amber-500",
    pendingText: "text-amber-700",
    checkbox: "text-amber-600",
    confirmBox: "border-amber-200 bg-amber-50/60",
    confirmTitle: "text-amber-900",
    confirmButton: "bg-amber-600",
  },
  mejora: {
    flagOffTitle: "Marcar la cuota con borde cian",
    flagOnTitle: "Quitar el borde cian de la cuota",
    listTitle: "Tareas de la mejora",
    empty: "Todavía no cargaste ninguna mejora.",
    placeholder: "Agregar una mejora…",
    newAria: "Nueva mejora",
    createdLabel: "Anotada",
    createdTitle: "Fecha en que se anotó",
    deleteTitle: "¿Eliminar esta mejora?",
    switchOn: "bg-cyan-600",
    pendingText: "text-cyan-700",
    checkbox: "text-cyan-600",
    confirmBox: "border-cyan-200 bg-cyan-50/60",
    confirmTitle: "text-cyan-900",
    confirmButton: "bg-cyan-600",
  },
} as const;

type Props = {
  kind: CuotaTaskKind;
  cobroId: string;
  dueDate: string;
  savedTasks: SolicitudTask[] | undefined;
  /** Interruptor manual: el borde de la cuota depende de él */
  flag: boolean;
  saving: boolean;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
};

/** Interruptor + checklist de una cuota. Se usa una vez por pestaña (Cambios pendientes y Mejoras). */
export default function CuotaTareasSection({
  kind,
  cobroId,
  dueDate,
  savedTasks,
  flag,
  saving,
  onPatch,
}: Props) {
  const v = VARIANTS[kind];
  const fields = CUOTA_TASK_FIELDS[kind];
  const [tasks, setTasks] = useState<SolicitudTask[]>(savedTasks ?? []);
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

  const taskDisplayDate = (t: SolicitudTask) => getTaskSortDate(t, dueDate);

  const taskDisplayFechaRealizada = (t: SolicitudTask) =>
    getTaskFechaRealizada(t) ?? todayYmd();

  const tasksSorted = useMemo(
    () => sortSolicitudTasksByFecha(tasks, dueDate),
    [tasks, dueDate],
  );

  const savedTaskDate = (taskId: string) => {
    const saved = savedTasks?.find((t) => t.id === taskId);
    return saved ? getTaskSortDate(saved, dueDate) : "";
  };

  const savedTaskFechaRealizada = (taskId: string) => {
    const saved = savedTasks?.find((t) => t.id === taskId);
    return saved ? getTaskFechaRealizada(saved) : null;
  };

  const savedTaskText = (taskId: string) =>
    savedTasks?.find((t) => t.id === taskId)?.text ?? "";

  useEffect(() => {
    if (
      editingTaskDateRef.current ||
      editingCompletedDateRef.current ||
      editingTaskTextRef.current
    ) {
      return;
    }
    setTasks(savedTasks ?? []);
  }, [cobroId, savedTasks]);

  const saveTasks = async (nextTasks: SolicitudTask[]) => {
    const normalized = nextTasks.map((t) => normalizeSolicitudTask(t, dueDate));
    setTasks(normalized);
    await onPatch({ [fields.tasks]: normalized, [fields.flag]: true });
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
      setTasks(savedTasks ?? []);
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
      setTasks(savedTasks ?? []);
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
      setTasks(savedTasks ?? []);
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

  const pendingCount = tasks.filter((t) => !t.done).length;
  const doneCount = tasks.length - pendingCount;
  /** Fecha chica, sin caja: se ve como texto y se edita al tocarla. */
  const inlineDateClass =
    "rounded px-1 py-0.5 text-xs font-medium border border-transparent hover:border-slate-200 hover:bg-white";

  return (
    <div role="tabpanel" className="border-t border-slate-100 px-3 py-2.5">
      {/* Tareas: lista tipo checklist, fechas como texto debajo */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {v.listTitle}
          </p>
          <div className="flex items-center gap-3">
            {tasks.length > 0 ? (
              <p className="text-xs text-slate-500">
                {pendingCount > 0 ? (
                  <span className={`font-semibold ${v.pendingText}`}>
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
            {/* Prende o apaga el borde de la cuota; agregar una tarea lo prende solo */}
            <button
              type="button"
              role="switch"
              aria-checked={flag}
              disabled={saving}
              onClick={() => void onPatch({ [fields.flag]: !flag })}
              title={flag ? v.flagOnTitle : v.flagOffTitle}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 cursor-pointer disabled:opacity-50"
            >
              Borde
              <span
                className={`relative h-4 w-7 rounded-full transition-colors ${
                  flag ? v.switchOn : "bg-slate-300"
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform ${
                    flag ? "translate-x-3" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <p className="py-1 text-sm text-slate-400">{v.empty}</p>
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
                  className={`mt-1.5 h-4 w-4 shrink-0 rounded border-slate-300 cursor-pointer ${v.checkbox}`}
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
                      {v.createdLabel}
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
                        title={v.createdTitle}
                        aria-label={v.createdTitle}
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
                          title="Volver a mostrar en la columna lateral"
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
                  onClick={() => setTaskPendingDelete(t)}
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
          <div className={`mt-2 rounded-lg border p-2.5 ${v.confirmBox}`}>
            <p className={`text-xs font-semibold ${v.confirmTitle}`}>¿Cuándo la entregaste?</p>
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
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50 ${v.confirmButton}`}
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
            placeholder={v.placeholder}
            disabled={saving}
            aria-label={v.newAria}
            className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
          />
          <DatePickerField
            value={newTaskDate}
            disabled={saving}
            onChange={setNewTaskDate}
            title={v.createdTitle}
            aria-label={v.createdTitle}
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
              {v.deleteTitle}
            </h3>
            <p className="text-sm text-slate-700 mb-1 line-clamp-3">{taskPendingDelete.text}</p>
            <p className="text-xs text-slate-500 mb-1">
              {v.createdLabel}: {formatLocalDate(taskDisplayDate(taskPendingDelete))}
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
