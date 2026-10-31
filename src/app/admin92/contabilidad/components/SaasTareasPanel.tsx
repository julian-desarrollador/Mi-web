"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import {
  prioridadesFromOrder,
  sortSaasTareas,
  type SaasTarea,
} from "@/app/admin92/contabilidad/lib/saasTareas";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  onCountChange?: (count: number) => void;
};

function mapApiTarea(raw: {
  _id?: string;
  id?: string;
  text: string;
  done: boolean;
  createdAt: string;
  fechaRealizada?: string;
  prioridad?: number;
}): SaasTarea {
  return {
    id: raw._id ?? raw.id ?? "",
    text: raw.text,
    done: raw.done,
    createdAt: raw.createdAt,
    fechaRealizada: raw.fechaRealizada,
    prioridad: raw.prioridad,
  };
}

type SortableRowProps = {
  tarea: SaasTarea;
  saving: boolean;
  dragEnabled: boolean;
  onToggle: (task: SaasTarea) => void;
  onDelete: (task: SaasTarea) => void;
  onTextChange: (id: string, text: string) => void;
  onTextFocus: (id: string) => void;
  onTextBlur: (id: string, text: string) => void;
  onDateChange: (id: string, createdAt: string) => void;
  onDateFocus: (id: string) => void;
  onDateBlur: (id: string, createdAt: string) => void;
  onRealDateChange: (id: string, fechaRealizada: string) => void;
  onRealDateFocus: (id: string) => void;
  onRealDateBlur: (id: string, fechaRealizada: string) => void;
};

function SortableSaasTaskRow({
  tarea: t,
  saving,
  dragEnabled,
  onToggle,
  onDelete,
  onTextChange,
  onTextFocus,
  onTextBlur,
  onDateChange,
  onDateFocus,
  onDateBlur,
  onRealDateChange,
  onRealDateFocus,
  onRealDateBlur,
}: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: t.id,
    disabled: !dragEnabled,
  });

  const style = {
    transform: transform ? CSS.Transform.toString(transform) : undefined,
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex flex-wrap items-start gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/30 px-2 py-2 ${
        isDragging ? "z-10 shadow-md ring-2 ring-indigo-200 bg-white" : ""
      }`}
    >
      <button
        type="button"
        aria-label="Reordenar tarea"
        title="Arrastrá para reordenar"
        className={`mt-0.5 shrink-0 rounded p-0.5 text-slate-400 touch-none select-none ${
          dragEnabled
            ? "cursor-grab active:cursor-grabbing hover:text-indigo-700"
            : "cursor-not-allowed opacity-40"
        }`}
        {...attributes}
        {...listeners}
        disabled={!dragEnabled}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <input
        type="checkbox"
        checked={t.done}
        disabled={saving}
        onChange={() => onToggle(t)}
        className="mt-0.5 rounded border-slate-300 text-indigo-600 cursor-pointer shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <input
          type="text"
          value={t.text}
          disabled={saving}
          onFocus={() => onTextFocus(t.id)}
          onChange={(e) => onTextChange(t.id, e.target.value)}
          onBlur={(e) => onTextBlur(t.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={`w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm outline-none focus:border-indigo-200 focus:bg-white disabled:opacity-50 ${
            t.done ? "text-slate-400 line-through" : "font-medium text-slate-900"
          }`}
        />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="text-slate-400">Ped.</span>
          <DatePickerField
            value={t.createdAt}
            disabled={saving}
            onFocus={() => onDateFocus(t.id)}
            onChange={(ymd) => onDateChange(t.id, ymd)}
            onBlur={(ymd) => onDateBlur(t.id, ymd)}
            title="Fecha pedido"
            aria-label="Fecha pedido"
            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700"
          />
          {t.done && (
            <>
              <span className="text-slate-400">Real.</span>
              <DatePickerField
                value={t.fechaRealizada ?? todayYmd()}
                disabled={saving}
                onFocus={() => onRealDateFocus(t.id)}
                onChange={(ymd) => onRealDateChange(t.id, ymd)}
                onBlur={(ymd) => onRealDateBlur(t.id, ymd)}
                title="Fecha realizada"
                aria-label="Fecha realizada"
                className="rounded border border-green-200 bg-green-50 px-1 py-0.5 text-[11px] text-green-800"
              />
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => onDelete(t)}
        className="shrink-0 p-1 text-slate-400 hover:text-red-600 cursor-pointer"
        aria-label="Eliminar tarea"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function DoneSaasTaskRow({
  tarea: t,
  saving,
  onToggle,
  onDelete,
  onTextChange,
  onTextFocus,
  onTextBlur,
  onDateChange,
  onDateFocus,
  onDateBlur,
  onRealDateChange,
  onRealDateFocus,
  onRealDateBlur,
}: Omit<SortableRowProps, "dragEnabled">) {
  return (
    <li className="flex flex-wrap items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-2 opacity-90">
      <span className="mt-0.5 w-5 shrink-0" aria-hidden />
      <input
        type="checkbox"
        checked={t.done}
        disabled={saving}
        onChange={() => onToggle(t)}
        className="mt-0.5 rounded border-slate-300 text-indigo-600 cursor-pointer shrink-0"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <input
          type="text"
          value={t.text}
          disabled={saving}
          onFocus={() => onTextFocus(t.id)}
          onChange={(e) => onTextChange(t.id, e.target.value)}
          onBlur={(e) => onTextBlur(t.id, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="w-full rounded border border-transparent bg-transparent px-1 py-0.5 text-sm text-slate-400 line-through outline-none focus:border-indigo-200 focus:bg-white disabled:opacity-50"
        />
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
          <span className="text-slate-400">Ped.</span>
          <DatePickerField
            value={t.createdAt}
            disabled={saving}
            onFocus={() => onDateFocus(t.id)}
            onChange={(ymd) => onDateChange(t.id, ymd)}
            onBlur={(ymd) => onDateBlur(t.id, ymd)}
            title="Fecha pedido"
            aria-label="Fecha pedido"
            className="rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] text-slate-700"
          />
          <span className="text-slate-400">Real.</span>
          <DatePickerField
            value={t.fechaRealizada ?? todayYmd()}
            disabled={saving}
            onFocus={() => onRealDateFocus(t.id)}
            onChange={(ymd) => onRealDateChange(t.id, ymd)}
            onBlur={(ymd) => onRealDateBlur(t.id, ymd)}
            title="Fecha realizada"
            aria-label="Fecha realizada"
            className="rounded border border-green-200 bg-green-50 px-1 py-0.5 text-[11px] text-green-800"
          />
        </div>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => onDelete(t)}
        className="shrink-0 p-1 text-slate-400 hover:text-red-600 cursor-pointer"
        aria-label="Eliminar tarea"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export default function SaasTareasPanel({ onCountChange }: Props) {
  const [tareas, setTareas] = useState<SaasTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState("");
  const [newTaskText, setNewTaskText] = useState("");
  const [newTaskDate, setNewTaskDate] = useState(todayYmd());
  const [taskPendingDelete, setTaskPendingDelete] = useState<SaasTarea | null>(null);
  const [pendingComplete, setPendingComplete] = useState<{
    taskId: string;
    text: string;
    fecha: string;
  } | null>(null);
  const editingTextRef = useRef<string | null>(null);
  const editingDateRef = useRef<string | null>(null);
  const editingRealDateRef = useRef<string | null>(null);
  const tareasRef = useRef(tareas);
  tareasRef.current = tareas;

  const sorted = useMemo(() => sortSaasTareas(tareas), [tareas]);
  const pendingSorted = useMemo(() => sorted.filter((t) => !t.done), [sorted]);
  const doneSorted = useMemo(() => sorted.filter((t) => t.done), [sorted]);
  const pendingIds = useMemo(() => pendingSorted.map((t) => t.id), [pendingSorted]);
  const pendingCount = pendingSorted.length;
  const dragEnabled =
    pendingSorted.length > 1 && !saving && !reordering && !pendingComplete && !taskPendingDelete;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  useEffect(() => {
    onCountChange?.(pendingCount);
  }, [pendingCount, onCountChange]);

  const loadTareas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/saas-tareas");
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar las tareas.");
      const list = Array.isArray(data.tareas) ? data.tareas.map(mapApiTarea) : [];
      if (!editingTextRef.current && !editingDateRef.current && !editingRealDateRef.current) {
        setTareas(list);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTareas();
  }, [loadTareas]);

  const patchTarea = async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/saas-tareas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo actualizar.");
      await loadTareas();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
      await loadTareas();
    } finally {
      setSaving(false);
    }
  };

  const savePrioridades = async (orderIds: string[]) => {
    const prioridades = prioridadesFromOrder(orderIds);
    const snapshot = tareasRef.current;

    setTareas((prev) =>
      prev.map((t) => {
        const p = prioridades.get(t.id);
        return p !== undefined ? { ...t, prioridad: p } : t;
      }),
    );

    setReordering(true);
    setError("");
    try {
      const results = await Promise.all(
        orderIds.map((id, idx) =>
          fetch(`/api/admin/saas-tareas/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prioridad: idx }),
          }).then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error || "No se pudo reordenar.");
          }),
        ),
      );
      void results;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al reordenar.");
      setTareas(snapshot);
      await loadTareas();
    } finally {
      setReordering(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (!dragEnabled) return;
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const oldIndex = pendingIds.indexOf(activeId);
    const newIndex = pendingIds.indexOf(overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(pendingIds, oldIndex, newIndex);
    void savePrioridades(newOrder);
  };

  const handleToggle = (task: SaasTarea) => {
    if (task.done) {
      void patchTarea(task.id, { done: false, fechaRealizada: null });
      setPendingComplete(null);
      return;
    }
    setPendingComplete({ taskId: task.id, text: task.text, fecha: todayYmd() });
  };

  const handleConfirmComplete = async () => {
    if (!pendingComplete) return;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pendingComplete.fecha)
      ? pendingComplete.fecha
      : todayYmd();
    setPendingComplete(null);
    await patchTarea(pendingComplete.taskId, { done: true, fechaRealizada: fecha });
  };

  const handleAdd = async () => {
    const text = newTaskText.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const nextPrioridad =
        pendingSorted.length > 0
          ? Math.max(...pendingSorted.map((t) => t.prioridad ?? 0)) + 1
          : 0;
      const res = await fetch("/api/admin/saas-tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          createdAt: /^\d{4}-\d{2}-\d{2}$/.test(newTaskDate) ? newTaskDate : todayYmd(),
          prioridad: nextPrioridad,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo crear la tarea.");
      setNewTaskText("");
      setNewTaskDate(todayYmd());
      await loadTareas();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al crear.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    setError("");
    setTaskPendingDelete(null);
    try {
      const res = await fetch(`/api/admin/saas-tareas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo eliminar.");
      await loadTareas();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar.");
    } finally {
      setSaving(false);
    }
  };

  const commitText = async (id: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      await loadTareas();
      return;
    }
    const saved = tareasRef.current.find((t) => t.id === id);
    if (saved?.text === trimmed) return;
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, text: trimmed } : t)));
    await patchTarea(id, { text: trimmed });
  };

  const commitDate = async (id: string, createdAt: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(createdAt)) {
      await loadTareas();
      return;
    }
    const saved = tareasRef.current.find((t) => t.id === id);
    if (saved?.createdAt === createdAt) return;
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, createdAt } : t)));
    await patchTarea(id, { createdAt });
  };

  const commitFechaRealizada = async (id: string, fechaRealizada: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaRealizada)) {
      await loadTareas();
      return;
    }
    const saved = tareasRef.current.find((t) => t.id === id);
    if (saved?.fechaRealizada === fechaRealizada) return;
    setTareas((prev) =>
      prev.map((t) => (t.id === id ? { ...t, fechaRealizada } : t)),
    );
    await patchTarea(id, { fechaRealizada });
  };

  const rowHandlers = {
    saving,
    onToggle: handleToggle,
    onDelete: setTaskPendingDelete,
    onTextChange: (id: string, text: string) =>
      setTareas((prev) => prev.map((x) => (x.id === id ? { ...x, text } : x))),
    onTextFocus: (id: string) => {
      editingTextRef.current = id;
    },
    onTextBlur: (id: string, text: string) => {
      editingTextRef.current = null;
      void commitText(id, text);
    },
    onDateChange: (id: string, createdAt: string) =>
      setTareas((prev) => prev.map((x) => (x.id === id ? { ...x, createdAt } : x))),
    onDateFocus: (id: string) => {
      editingDateRef.current = id;
    },
    onDateBlur: (id: string, createdAt: string) => {
      editingDateRef.current = null;
      void commitDate(id, createdAt);
    },
    onRealDateChange: (id: string, fechaRealizada: string) =>
      setTareas((prev) => prev.map((x) => (x.id === id ? { ...x, fechaRealizada } : x))),
    onRealDateFocus: (id: string) => {
      editingRealDateRef.current = id;
    },
    onRealDateBlur: (id: string, fechaRealizada: string) => {
      editingRealDateRef.current = null;
      void commitFechaRealizada(id, fechaRealizada);
    },
  };

  if (loading && tareas.length === 0) {
    return <p className="text-sm text-slate-500 py-4 text-center">Cargando tareas SaaS…</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-1.5">
          {error}
        </p>
      )}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 py-4 text-center">
          Sin tareas del producto SaaS. Agregá la primera abajo.
        </p>
      ) : (
        <div className="space-y-2 max-h-[min(380px,45vh)] overflow-y-auto pr-0.5">
          {pendingSorted.length > 0 && (
            <div className="space-y-1.5">
              {pendingSorted.length > 1 && (
                <p className="text-[10px] text-slate-500 px-1">
                  Arrastrá el ícono ≡ para reordenar las tareas pendientes.
                </p>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={pendingIds} strategy={verticalListSortingStrategy}>
                  <ul className="space-y-1.5">
                    {pendingSorted.map((t) => (
                      <SortableSaasTaskRow
                        key={t.id}
                        tarea={t}
                        dragEnabled={dragEnabled}
                        {...rowHandlers}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {doneSorted.length > 0 && (
            <div className="space-y-1.5">
              {pendingSorted.length > 0 && (
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400 px-1 pt-1">
                  Realizadas
                </p>
              )}
              <ul className="space-y-1.5">
                {doneSorted.map((t) => (
                  <DoneSaasTaskRow key={t.id} tarea={t} {...rowHandlers} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {pendingComplete && (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-indigo-200 bg-indigo-50/60 p-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-indigo-900 mb-1">Marcar tarea realizada</p>
            <p className="text-xs text-slate-700 line-clamp-2">{pendingComplete.text}</p>
          </div>
          <label className="text-xs text-slate-700">
            Fecha realizada
            <DatePickerField
              value={pendingComplete.fecha}
              onChange={(ymd) =>
                setPendingComplete((prev) => (prev ? { ...prev, fecha: ymd } : prev))
              }
              className="mt-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleConfirmComplete()}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
          >
            Confirmar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => setPendingComplete(null)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-2">
        <input
          type="text"
          value={newTaskText}
          onChange={(e) => setNewTaskText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleAdd();
          }}
          placeholder="Nueva tarea SaaS…"
          disabled={saving}
          className="min-w-[140px] flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        <DatePickerField
          value={newTaskDate}
          onChange={setNewTaskDate}
          disabled={saving}
          title="Fecha pedido"
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700"
        />
        <button
          type="button"
          disabled={saving || !newTaskText.trim()}
          onClick={() => void handleAdd()}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>

      {(saving || reordering) && (
        <p className="text-xs text-slate-400">{reordering ? "Guardando orden…" : "Guardando…"}</p>
      )}

      {taskPendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <p className="text-sm font-semibold text-slate-900 mb-1">Eliminar tarea</p>
            <p className="text-sm text-slate-600 mb-4 line-clamp-3">{taskPendingDelete.text}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setTaskPendingDelete(null)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleDelete(taskPendingDelete.id)}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white cursor-pointer disabled:opacity-50"
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
