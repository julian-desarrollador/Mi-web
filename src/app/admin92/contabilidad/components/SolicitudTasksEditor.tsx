"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  getTaskFechaRealizada,
  getTaskSortDate,
  newSolicitudTaskId,
  normalizeSolicitudTask,
  sortSolicitudTasksByFecha,
  type SolicitudTask,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { formatLocalDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  tasks: SolicitudTask[];
  /** Fecha ancla (dueDate cuota o fechaCobro50) para orden/fallback */
  anchorDate: string;
  title?: string;
  disabled?: boolean;
  onSave: (nextTasks: SolicitudTask[]) => Promise<void>;
};

export default function SolicitudTasksEditor({
  tasks: tasksProp,
  anchorDate,
  title = "Tareas",
  disabled = false,
  onSave,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tasks, setTasks] = useState<SolicitudTask[]>(tasksProp);
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

  const taskDisplayDate = (t: SolicitudTask) => getTaskSortDate(t, anchorDate);
  const taskDisplayFechaRealizada = (t: SolicitudTask) =>
    getTaskFechaRealizada(t) ?? todayYmd();

  const tasksSorted = useMemo(
    () => sortSolicitudTasksByFecha(tasks, anchorDate),
    [tasks, anchorDate],
  );

  const savedTaskDate = (taskId: string) => {
    const saved = tasksProp.find((t) => t.id === taskId);
    return saved ? getTaskSortDate(saved, anchorDate) : "";
  };

  const savedTaskFechaRealizada = (taskId: string) => {
    const saved = tasksProp.find((t) => t.id === taskId);
    return saved ? getTaskFechaRealizada(saved) : null;
  };

  const savedTaskText = (taskId: string) =>
    tasksProp.find((t) => t.id === taskId)?.text ?? "";

  useEffect(() => {
    if (
      editingTaskDateRef.current ||
      editingCompletedDateRef.current ||
      editingTaskTextRef.current
    ) {
      return;
    }
    setTasks(tasksProp);
  }, [tasksProp]);

  const saveTasks = async (nextTasks: SolicitudTask[]) => {
    const normalized = nextTasks.map((t) => normalizeSolicitudTask(t, anchorDate));
    setTasks(normalized);
    setSaving(true);
    setError("");
    try {
      await onSave(normalized);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
      setTasks(tasksProp);
    } finally {
      setSaving(false);
    }
  };

  const busy = disabled || saving;

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

  const commitTaskText = async (taskId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setTasks(tasksProp);
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
      setTasks(tasksProp);
      return;
    }
    if (savedTaskDate(taskId) === createdAt) return;
    const next = tasksRef.current.map((t) =>
      t.id === taskId ? { ...t, createdAt } : t,
    );
    await saveTasks(next);
  };

  const commitTaskFechaRealizada = async (taskId: string, fechaRealizada: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRealizada)) {
      setTasks(tasksProp);
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

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-slate-700">{title}</p>
      <ul className="space-y-1.5">
        {tasksSorted.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md px-1 -mx-1">
            <input
              type="checkbox"
              checked={t.done}
              disabled={busy}
              onChange={() => void handleToggleTask(t.id)}
              className="rounded border-slate-300 text-sky-600 cursor-pointer shrink-0"
            />
            <input
              type="text"
              value={t.text}
              disabled={busy}
              onFocus={() => {
                editingTaskTextRef.current = t.id;
              }}
              onChange={(e) =>
                setTasks((prev) =>
                  prev.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)),
                )
              }
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
              }`}
            />
            <span className="flex shrink-0 items-center gap-1">
              <span className="text-[10px] text-slate-400 w-7 text-right">Ped.</span>
              <DatePickerField
                value={taskDisplayDate(t)}
                disabled={busy}
                onFocus={() => {
                  editingTaskDateRef.current = t.id;
                }}
                onChange={(ymd) =>
                  setTasks((prev) =>
                    prev.map((x) =>
                      x.id === t.id ? { ...x, createdAt: ymd } : x,
                    ),
                  )
                }
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
                <span className="text-[10px] text-slate-400 w-12 text-right">Entregado</span>
                <DatePickerField
                  value={taskDisplayFechaRealizada(t)}
                  disabled={busy}
                  onFocus={() => {
                    editingCompletedDateRef.current = t.id;
                  }}
                  onChange={(ymd) =>
                    setTasks((prev) =>
                      prev.map((x) =>
                        x.id === t.id ? { ...x, fechaRealizada: ymd } : x,
                      ),
                    )
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
            <button
              type="button"
              disabled={busy}
              onClick={() => setTaskPendingDelete(t)}
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
            disabled={busy}
            onClick={() => void handleConfirmTaskComplete()}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={busy}
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
              void handleAddTask();
            }
          }}
          placeholder="Nueva tarea…"
          disabled={busy}
          className="min-w-[120px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
        />
        <DatePickerField
          value={newTaskDate}
          disabled={busy}
          onChange={setNewTaskDate}
          title="Fecha pedido de la nueva tarea"
          className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
        />
        <button
          type="button"
          disabled={busy || !newTaskText.trim()}
          onClick={() => void handleAddTask()}
          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 cursor-pointer disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {saving && <p className="text-xs text-slate-400">Guardando…</p>}

      {taskPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <p className="text-sm font-semibold text-slate-900 mb-2">Eliminar tarea</p>
            <p className="text-sm text-slate-700 mb-1 line-clamp-3">{taskPendingDelete.text}</p>
            <p className="text-xs text-slate-500 mb-4">
              Pedido {formatLocalDate(getTaskSortDate(taskPendingDelete, anchorDate))}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setTaskPendingDelete(null)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleRemoveTask(taskPendingDelete.id)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white cursor-pointer disabled:opacity-50"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
