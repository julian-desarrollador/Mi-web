"use client";

import { useEffect, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Check, ChevronRight, GripVertical, Package, Plus, Trash2, X } from "lucide-react";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import {
  ENTREGABLE_DAY_PART_LABEL,
  ENTREGABLE_DAY_PARTS,
  ENTREGABLE_STATUS_LABEL,
  ENTREGABLE_STATUSES,
  sortEntregables,
  type EntregableDayPart,
  type EntregableStatus,
  type ErpEntregable,
  type ErpEntregableBlock,
  type ErpEntregableSubtask,
} from "@/app/admin92/erp/lib/erpEntregables";

type TaskDraft = {
  title: string;
  description: string;
  dueOn: string;
  dayPart: EntregableDayPart | "";
  status: EntregableStatus;
  blockId: string;
};

function formatDayMonth(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function formatCreatedDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

function emptyDraft(blockId: string): TaskDraft {
  return { title: "", description: "", dueOn: "", dayPart: "", status: "pending", blockId };
}

function draftFromItem(item: ErpEntregable): TaskDraft {
  return {
    title: item.title,
    description: item.description ?? "",
    dueOn: item.dueOn ?? "",
    dayPart: item.dayPart ?? "",
    status: item.status,
    blockId: item.blockId,
  };
}

function placeItem(blocks: ErpEntregableBlock[], item: ErpEntregable): ErpEntregableBlock[] {
  return blocks.map((block) => {
    const without = block.items.filter((row) => row._id !== item._id);
    if (block._id !== item.blockId) return { ...block, items: sortEntregables(without) };
    return { ...block, items: sortEntregables([...without, item]) };
  });
}

function DayPartButtons({
  value,
  onChange,
  disabled,
}: {
  value: EntregableDayPart | "";
  onChange: (dayPart: EntregableDayPart | "") => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ENTREGABLE_DAY_PARTS.map((part) => {
        const selected = value === part;
        return (
          <button
            key={part}
            type="button"
            disabled={disabled}
            onClick={() => onChange(selected ? "" : part)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer disabled:opacity-50 ${
              selected
                ? "border-[#1d4e89] bg-[#1d4e89] text-white"
                : "border-[#c5d4e8] bg-white text-[#3d5270] hover:bg-[#e4eef8]"
            }`}
          >
            {ENTREGABLE_DAY_PART_LABEL[part]}
          </button>
        );
      })}
    </div>
  );
}

function taskBorderClass(status: EntregableStatus): string {
  if (status === "in_progress") return "border-amber-400";
  if (status === "done") return "border-green-700";
  return "border-[#1d4e89]";
}

function StatusButtons({
  value,
  onChange,
  disabled,
}: {
  value: EntregableStatus;
  onChange: (status: EntregableStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {ENTREGABLE_STATUSES.map((status) => {
        const selected = value === status;
        const tone = selected
          ? status === "in_progress"
            ? "border-amber-400 bg-amber-400 text-slate-950"
            : status === "done"
              ? "border-green-700 bg-green-700 text-white"
              : "border-[#1d4e89] bg-[#1d4e89] text-white"
          : "border-[#c5d4e8] bg-white text-[#3d5270] hover:bg-[#e4eef8]";
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            onClick={() => onChange(status)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold cursor-pointer disabled:opacity-50 ${tone}`}
          >
            {ENTREGABLE_STATUS_LABEL[status]}
          </button>
        );
      })}
    </div>
  );
}

function ConfirmDeleteDialog({
  title,
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  name: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onCancel();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-neutral-950/45 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-sm rounded-2xl border border-[#b7cce4] bg-[#e4eef8] p-5 shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <h3 className="text-base font-semibold text-[#0f2744]">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#3d5270]">
          ¿Eliminar <span className="font-semibold text-[#0f2744]">“{name}”</span>? Esta acción no
          se puede deshacer.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[#c5d4e8] bg-white px-3.5 py-2 text-sm font-semibold text-[#3d5270] hover:bg-[#e4eef8] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

function SortableSubtaskRow({
  row,
  disabled,
  dragDisabled,
  editing,
  editingTitle,
  onToggle,
  onStartEdit,
  onEditingTitle,
  onCommitTitle,
  onCancelEdit,
  onDueChange,
  onRemove,
}: {
  row: ErpEntregableSubtask;
  disabled: boolean;
  dragDisabled: boolean;
  editing: boolean;
  editingTitle: string;
  onToggle: () => void;
  onStartEdit: () => void;
  onEditingTitle: (title: string) => void;
  onCommitTitle: () => void;
  onCancelEdit: () => void;
  onDueChange: (dueOn: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: dragDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 ${isDragging ? "relative z-10 rounded-md bg-white" : ""}`}
    >
      <button
        type="button"
        aria-label={`Reordenar ${row.title}`}
        title="Arrastrá para reordenar"
        disabled={dragDisabled}
        className={`mt-0.5 shrink-0 rounded p-0.5 text-[#3d5270] touch-none select-none ${
          dragDisabled
            ? "cursor-not-allowed opacity-40"
            : "cursor-grab hover:bg-[#e4eef8] hover:text-[#1d4e89] active:cursor-grabbing"
        }`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="checkbox"
        aria-checked={row.done}
        aria-label={row.done ? `Marcar pendiente ${row.title}` : `Marcar hecha ${row.title}`}
        disabled={disabled}
        onClick={onToggle}
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border cursor-pointer disabled:opacity-50 ${
          row.done
            ? "border-green-700 bg-green-700 text-white"
            : "border-[#1d4e89] bg-white text-[#1d4e89]"
        }`}
      >
        {row.done ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
      </button>
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            value={editingTitle}
            autoFocus
            aria-label={`Título de ${row.title}`}
            onChange={(event) => onEditingTitle(event.target.value)}
            onBlur={onCommitTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onCancelEdit();
              }
            }}
            className="w-full rounded-md border border-[#c5d4e8] bg-white px-2 py-0.5 text-sm text-[#0f2744]"
          />
        ) : (
          <button
            type="button"
            onClick={onStartEdit}
            className={`block w-full cursor-pointer whitespace-normal break-words text-left text-sm ${
              row.done ? "text-[#3d5270] line-through" : "text-[#0f2744]"
            }`}
          >
            {row.title}
          </button>
        )}
        <p className="text-[11px] text-[#3d5270]">Cargada {formatCreatedDay(row.createdAt)}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="text-[11px] font-medium text-[#3d5270]">Entrega</span>
        <DatePickerField
          value={row.dueOn ?? ""}
          onChange={onDueChange}
          disabled={disabled}
          allowClear
          placeholder="Sin fecha"
          aria-label={`Entrega de ${row.title}`}
          placement="center"
          className="rounded-md border border-[#c5d4e8] bg-white px-1.5 py-0.5 text-xs font-semibold text-[#1d4e89]"
        />
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-label={`Quitar ${row.title}`}
        onClick={onRemove}
        className="rounded-md p-1 text-[#3d5270] hover:text-rose-600 cursor-pointer disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function TaskSubtasks({
  item,
  disabled,
  onSave,
}: {
  item: ErpEntregable;
  disabled?: boolean;
  onSave: (subtasks: ErpEntregableSubtask[]) => Promise<ErpEntregable | null>;
}) {
  const subtasks = item.subtasks ?? [];
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDue, setDraftDue] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState<ErpEntregableSubtask[] | null>(null);
  const [subtaskToDelete, setSubtaskToDelete] = useState<ErpEntregableSubtask | null>(null);
  const list = pending ?? subtasks;
  const doneCount = list.filter((row) => row.done).length;
  const busy = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  useEffect(() => {
    setPending(null);
  }, [item.updatedAt]);

  useEffect(() => {
    if (!expanded) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('[aria-label="Elegir fecha"]')) return;
      if (rootRef.current?.contains(target)) return;
      setExpanded(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [expanded]);

  const save = async (next: ErpEntregableSubtask[]) => {
    if (busy.current || disabled) return null;
    busy.current = true;
    try {
      return await onSave(next);
    } finally {
      busy.current = false;
    }
  };

  const addSubtask = async () => {
    const title = draftTitle.trim();
    if (!title || disabled) return;
    const saved = await save([
      ...list,
      {
        id: crypto.randomUUID(),
        title,
        done: false,
        dueOn: draftDue || null,
        createdAt: new Date().toISOString(),
      },
    ]);
    if (saved) {
      setDraftTitle("");
      setDraftDue("");
    }
  };

  const commitTitle = (id: string) => {
    const title = editingTitle.trim();
    setEditingId(null);
    if (!title) return;
    const current = list.find((row) => row.id === id);
    if (!current || current.title === title) return;
    void save(list.map((row) => (row.id === id ? { ...row, title } : row)));
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = list.findIndex((row) => row.id === active.id);
    const newIndex = list.findIndex((row) => row.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(list, oldIndex, newIndex);
    setPending(next);
    void save(next).then((saved) => {
      if (!saved) setPending(null);
    });
  };

  return (
    <div ref={rootRef} className="mt-2 space-y-1.5">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-semibold text-[#1d4e89] hover:bg-[#e4eef8] cursor-pointer"
      >
        <ChevronRight className={`h-3.5 w-3.5 ${expanded ? "rotate-90" : ""}`} />
        Subtareas
        {list.length > 0 ? (
          <span className="font-medium text-[#3d5270]">
            {doneCount}/{list.length}
          </span>
        ) : null}
      </button>
      {expanded ? (
      <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={list.map((row) => row.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-1.5">
            {list.map((row) => (
              <SortableSubtaskRow
                key={row.id}
                row={row}
                disabled={Boolean(disabled)}
                dragDisabled={Boolean(disabled) || list.length < 2}
                editing={editingId === row.id}
                editingTitle={editingTitle}
                onToggle={() => {
                  void save(
                    list.map((entry) =>
                      entry.id === row.id ? { ...entry, done: !entry.done } : entry,
                    ),
                  );
                }}
                onStartEdit={() => {
                  setEditingId(row.id);
                  setEditingTitle(row.title);
                }}
                onEditingTitle={setEditingTitle}
                onCommitTitle={() => commitTitle(row.id)}
                onCancelEdit={() => setEditingId(null)}
                onDueChange={(dueOn) => {
                  void save(
                    list.map((entry) =>
                      entry.id === row.id ? { ...entry, dueOn: dueOn || null } : entry,
                    ),
                  );
                }}
                onRemove={() => setSubtaskToDelete(row)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      <div className="flex items-center gap-2">
        <input
          value={draftTitle}
          disabled={disabled}
          onChange={(event) => setDraftTitle(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void addSubtask();
            }
          }}
          placeholder="Subtarea"
          aria-label="Nueva subtarea"
          className="min-w-0 flex-1 rounded-md border border-[#c5d4e8] bg-white px-2 py-1 text-sm text-[#0f2744] placeholder:text-[#3d5270]"
        />
        <DatePickerField
          value={draftDue}
          onChange={setDraftDue}
          disabled={disabled}
          allowClear
          placeholder="Sin fecha"
          aria-label="Entrega de la subtarea"
          placement="center"
          className="rounded-md border border-[#c5d4e8] bg-white px-1.5 py-1 text-xs font-semibold text-[#1d4e89]"
        />
        <button
          type="button"
          disabled={disabled || !draftTitle.trim()}
          onClick={() => void addSubtask()}
          aria-label="Agregar subtarea"
          className="rounded-md border border-[#1d4e89] bg-[#1d4e89] p-1 text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      </>
      ) : null}
      {subtaskToDelete ? (
        <ConfirmDeleteDialog
          title="Eliminar subtarea"
          name={subtaskToDelete.title}
          busy={disabled}
          onCancel={() => setSubtaskToDelete(null)}
          onConfirm={() => {
            const target = subtaskToDelete;
            void save(list.filter((entry) => entry.id !== target.id)).then((saved) => {
              if (saved) setSubtaskToDelete(null);
            });
          }}
        />
      ) : null}
    </div>
  );
}

export default function ErpEntregables() {
  const [open, setOpen] = useState(false);
  const [blocks, setBlocks] = useState<ErpEntregableBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newBlockName, setNewBlockName] = useState("");
  const [nameEditId, setNameEditId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [createDrafts, setCreateDrafts] = useState<Record<string, TaskDraft>>({});
  const [composerOpen, setComposerOpen] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskDraft | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<ErpEntregable | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const editDraftRef = useRef<TaskDraft | null>(null);
  const createDraftsRef = useRef<Record<string, TaskDraft>>({});
  const composerRefs = useRef(new Map<string, HTMLDivElement>());
  const editFormRef = useRef<HTMLLIElement | null>(null);

  const updateEditDraft = (patch: Partial<TaskDraft>) => {
    const prev = editDraftRef.current;
    if (!prev) return;
    const next = { ...prev, ...patch };
    editDraftRef.current = next;
    setEditDraft(next);
  };

  const closeEdit = () => {
    editingIdRef.current = null;
    editDraftRef.current = null;
    setEditingId(null);
    setEditDraft(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const scrollY = window.scrollY;
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyLeft = document.body.style.left;
    const prevBodyRight = document.body.style.right;
    const prevBodyWidth = document.body.style.width;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = scrollbarWidth > 0 ? `calc(100% - ${scrollbarWidth}px)` : "100%";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.left = prevBodyLeft;
      document.body.style.right = prevBodyRight;
      document.body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadBlocks();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest('[aria-label="Elegir fecha"]')) return;

      const editForm = editFormRef.current;
      if (editingIdRef.current && editForm && !editForm.contains(target)) {
        closeEdit();
      }

      setComposerOpen((prev) => {
        const openIds = Object.keys(prev).filter((id) => prev[id]);
        if (openIds.length === 0) return prev;
        let changed = false;
        const next = { ...prev };
        for (const id of openIds) {
          const node = composerRefs.current.get(id);
          if (node?.contains(target)) continue;
          next[id] = false;
          changed = true;
        }
        return changed ? next : prev;
      });
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const loadBlocks = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/erp-entregables", { cache: "no-store" });
      const data = (await response.json()) as {
        blocks?: ErpEntregableBlock[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los entregables.");
      setBlocks(data.blocks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los entregables.");
    } finally {
      setLoading(false);
    }
  };

  const createBlock = async () => {
    const name = newBlockName.trim();
    if (!name) {
      setError("El nombre del bloque es requerido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/erp-entregables/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { block?: ErpEntregableBlock; error?: string };
      if (!response.ok || !data.block) {
        throw new Error(data.error || "No se pudo crear el bloque.");
      }
      setBlocks((prev) => [...prev, { ...data.block!, items: data.block!.items ?? [] }]);
      setNewBlockName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el bloque.");
    } finally {
      setSaving(false);
    }
  };

  const renameBlock = async (block: ErpEntregableBlock) => {
    const name = nameDraft.trim();
    setNameEditId(null);
    if (!name || name === block.name) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/erp-entregables/blocks/${block._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = (await response.json()) as { block?: ErpEntregableBlock; error?: string };
      if (!response.ok || !data.block) {
        throw new Error(data.error || "No se pudo renombrar el bloque.");
      }
      setBlocks((prev) =>
        prev.map((row) =>
          row._id === block._id ? { ...row, name: data.block!.name } : row,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renombrar el bloque.");
    } finally {
      setSaving(false);
    }
  };

  const removeBlock = async (block: ErpEntregableBlock) => {
    const ok = window.confirm(
      `¿Eliminar el bloque “${block.name}” y sus ${block.items.length} tareas?`,
    );
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/erp-entregables/blocks/${block._id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el bloque.");
      setBlocks((prev) => prev.filter((row) => row._id !== block._id));
      if (editingIdRef.current && block.items.some((item) => item._id === editingIdRef.current)) {
        closeEdit();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el bloque.");
    } finally {
      setSaving(false);
    }
  };

  const createItem = async (blockId: string) => {
    const draft = createDraftsRef.current[blockId] ?? emptyDraft(blockId);
    if (!draft.title.trim()) {
      setError("El título es requerido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/erp-entregables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockId,
          title: draft.title,
          description: draft.description,
          dueOn: draft.dueOn || null,
          dayPart: draft.dayPart || null,
          status: draft.status,
        }),
      });
      const data = (await response.json()) as { item?: ErpEntregable; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error || "No se pudo crear la tarea.");
      }
      setBlocks((prev) => placeItem(prev, data.item!));
      const nextDrafts = { ...createDraftsRef.current, [blockId]: emptyDraft(blockId) };
      createDraftsRef.current = nextDrafts;
      setCreateDrafts(nextDrafts);
      setComposerOpen((prev) => ({ ...prev, [blockId]: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la tarea.");
    } finally {
      setSaving(false);
    }
  };

  const patchItem = async (id: string, body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/erp-entregables/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { item?: ErpEntregable; error?: string };
      if (!response.ok || !data.item) {
        throw new Error(data.error || "No se pudo actualizar la tarea.");
      }
      setBlocks((prev) => {
        const current = prev
          .flatMap((block) => block.items)
          .find((row) => row._id === data.item!._id);
        if (current && current.updatedAt > data.item!.updatedAt) return prev;
        return placeItem(prev, data.item!);
      });
      return data.item;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la tarea.");
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    const id = editingIdRef.current;
    const draft = editDraftRef.current;
    if (!id || !draft) return;
    if (!draft.title.trim()) {
      setError("El título es requerido.");
      return;
    }
    const item = await patchItem(id, {
      blockId: draft.blockId,
      title: draft.title,
      description: draft.description,
      dueOn: draft.dueOn || null,
      dayPart: draft.dayPart || null,
      status: draft.status,
    });
    if (item) closeEdit();
  };

  const removeItem = async (item: ErpEntregable) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/erp-entregables/${item._id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar la tarea.");
      setBlocks((prev) =>
        prev.map((block) => ({
          ...block,
          items: block.items.filter((row) => row._id !== item._id),
        })),
      );
      if (editingIdRef.current === item._id) closeEdit();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la tarea.");
    } finally {
      setSaving(false);
      setTaskToDelete(null);
    }
  };

  const startEdit = (item: ErpEntregable) => {
    const draft = draftFromItem(item);
    editingIdRef.current = item._id;
    editDraftRef.current = draft;
    setEditingId(item._id);
    setEditDraft(draft);
    setError(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
      >
        <Package className="h-4 w-4 text-yellow-500" />
        Entregables
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overscroll-none bg-neutral-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="erp-entregables-title"
            className="flex max-h-[min(44rem,90vh)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[#b7cce4] bg-[#e4eef8] shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#b7cce4] bg-[#d5e4f4] px-5 py-4">
              <h2 id="erp-entregables-title" className="text-lg font-semibold text-[#0f2744]">
                Entregables
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="rounded-lg p-1.5 text-[#3d5270] transition hover:bg-[#e4eef8] hover:text-[#0f2744] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {error ? (
                <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              {loading && blocks.length === 0 ? (
                <p className="text-sm text-[#3d5270]">Cargando…</p>
              ) : null}

              {!loading && blocks.length === 0 ? (
                <p className="text-sm text-[#3d5270]">
                  Todavía no hay bloques. Agregá el primero, por ejemplo SaaS o Clientes.
                </p>
              ) : null}

              <div className="flex items-start gap-4 overflow-x-auto">
              {blocks.map((block) => {
                const draft = createDrafts[block._id] ?? emptyDraft(block._id);
                const setDraft = (patch: Partial<TaskDraft>) => {
                  const prev = createDraftsRef.current[block._id] ?? emptyDraft(block._id);
                  const next = {
                    ...createDraftsRef.current,
                    [block._id]: { ...prev, ...patch },
                  };
                  createDraftsRef.current = next;
                  setCreateDrafts(next);
                };

                return (
                  <section
                    key={block._id}
                    className="min-w-[18rem] flex-1 rounded-xl border border-[#c5d4e8] bg-white p-3"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        value={nameEditId === block._id ? nameDraft : block.name}
                        onFocus={() => {
                          setNameEditId(block._id);
                          setNameDraft(block.name);
                        }}
                        onChange={(event) => setNameDraft(event.target.value)}
                        onBlur={() => void renameBlock(block)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            event.currentTarget.blur();
                          }
                        }}
                        aria-label="Nombre del bloque"
                        className="min-w-0 flex-1 rounded-lg border border-[#c5d4e8] bg-[#f4f8fc] px-2.5 py-1.5 text-sm font-semibold text-[#0f2744] outline-none focus:border-[#1d4e89]"
                      />
                      <button
                        type="button"
                        onClick={() => void removeBlock(block)}
                        disabled={saving}
                        aria-label={`Eliminar bloque ${block.name}`}
                        className="rounded-lg p-1.5 text-[#3d5270] hover:bg-[#f4f8fc] hover:text-rose-600 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {block.items.length === 0 ? (
                      <p className="mb-3 text-xs text-[#3d5270]">Sin tareas.</p>
                    ) : (
                      <ul className="mb-3 space-y-2">
                        {block.items.map((item) =>
                          editingId === item._id && editDraft ? (
                            <li
                              key={item._id}
                              ref={editFormRef}
                              className={`space-y-2 rounded-lg border max-md:bg-white md:bg-[radial-gradient(black,transparent)] p-3 ${taskBorderClass(editDraft.status)}`}
                            >
                              <input
                                value={editDraft.title}
                                onChange={(event) => updateEditDraft({ title: event.target.value })}
                                aria-label="Título"
                                className="w-full rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm text-[#0f2744]"
                              />
                              <textarea
                                value={editDraft.description}
                                onChange={(event) =>
                                  updateEditDraft({ description: event.target.value })
                                }
                                rows={2}
                                placeholder="Descripción (opcional)"
                                className="w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm text-[#0f2744]"
                              />
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] font-medium text-[#3d5270]">Entrega</span>
                                <DatePickerField
                                  value={editDraft.dueOn}
                                  onChange={(dueOn) => updateEditDraft({ dueOn })}
                                  allowClear
                                  placeholder="Sin fecha de entrega"
                                  aria-label="Entrega"
                                  placement="center"
                                  className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm text-[#0f2744]"
                                />
                              </div>
                              <DayPartButtons
                                value={editDraft.dayPart}
                                onChange={(dayPart) => updateEditDraft({ dayPart })}
                              />
                              <StatusButtons
                                value={editDraft.status}
                                onChange={(status) => updateEditDraft({ status })}
                                disabled={saving}
                              />
                              <TaskSubtasks
                                item={item}
                                disabled={saving}
                                onSave={(subtasks) => patchItem(item._id, { subtasks })}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={closeEdit}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#3d5270] hover:bg-[#e4eef8] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => void saveEdit()}
                                  className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
                                >
                                  Guardar
                                </button>
                              </div>
                            </li>
                          ) : (
                            <li
                              key={item._id}
                              className={`rounded-lg border max-md:bg-white md:bg-[radial-gradient(black,transparent)] px-3 py-2 ${taskBorderClass(item.status)}`}
                            >
                              <div className="flex items-start gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEdit(item)}
                                  className="min-w-0 flex-1 cursor-pointer text-left"
                                >
                                  <span
                                    className={`block whitespace-normal break-words text-sm font-semibold ${
                                      item.status === "done"
                                        ? "text-[#3d5270] line-through"
                                        : "text-[#0f2744]"
                                    }`}
                                  >
                                    {item.title}
                                  </span>
                                  {item.description ? (
                                    <span className="mt-0.5 block line-clamp-2 text-xs text-[#3d5270]">
                                      {item.description}
                                    </span>
                                  ) : null}
                                  <span className="mt-0.5 block text-xs text-[#3d5270]">
                                    Cargada {formatCreatedDay(item.createdAt)}
                                  </span>
                                </button>
                                {item.dueOn || item.dayPart ? (
                                  <span className="flex shrink-0 flex-col items-end">
                                    <span className="text-[11px] font-medium text-[#3d5270]">
                                      Entrega
                                    </span>
                                    {item.dueOn ? (
                                      <span className="whitespace-nowrap text-sm font-semibold text-[#1d4e89]">
                                        {formatDayMonth(item.dueOn)}
                                      </span>
                                    ) : null}
                                    {item.dayPart ? (
                                      <span className="whitespace-nowrap text-sm font-semibold text-[#1d4e89]">
                                        {ENTREGABLE_DAY_PART_LABEL[item.dayPart]}
                                      </span>
                                    ) : null}
                                  </span>
                                ) : null}
                                <div className="flex shrink-0 items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => setTaskToDelete(item)}
                                    disabled={saving}
                                    aria-label={`Eliminar ${item.title}`}
                                    className="rounded-md p-1 text-[#3d5270] hover:text-rose-600 cursor-pointer disabled:opacity-50"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                              <TaskSubtasks
                                item={item}
                                disabled={saving}
                                onSave={(subtasks) => patchItem(item._id, { subtasks })}
                              />
                              <div className="mt-2">
                                <StatusButtons
                                  value={item.status}
                                  disabled={saving}
                                  onChange={(status) => {
                                    if (status === item.status) return;
                                    void patchItem(item._id, { status });
                                  }}
                                />
                              </div>
                            </li>
                          ),
                        )}
                      </ul>
                    )}

                    {composerOpen[block._id] ? (
                    <div
                      ref={(node) => {
                        if (node) composerRefs.current.set(block._id, node);
                        else composerRefs.current.delete(block._id);
                      }}
                      className="space-y-2 rounded-lg border border-dashed border-[#c5d4e8] bg-[#f4f8fc] p-3"
                    >
                      <input
                        value={draft.title}
                        onChange={(event) => setDraft({ title: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void createItem(block._id);
                          }
                        }}
                        placeholder="Nueva tarea"
                        className="w-full rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm text-[#0f2744]"
                      />
                      <textarea
                        value={draft.description}
                        onChange={(event) => setDraft({ description: event.target.value })}
                        rows={2}
                        placeholder="Descripción (opcional)"
                        className="w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm text-[#0f2744]"
                      />
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="text-[11px] font-medium text-[#3d5270]">Entrega</span>
                            <DatePickerField
                              value={draft.dueOn}
                              onChange={(dueOn) => setDraft({ dueOn })}
                              allowClear
                              placeholder="Sin fecha de entrega"
                              aria-label="Entrega"
                              placement="center"
                              className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm text-[#0f2744]"
                            />
                          </div>
                          <DayPartButtons
                            value={draft.dayPart}
                            onChange={(dayPart) => setDraft({ dayPart })}
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setComposerOpen((prev) => ({ ...prev, [block._id]: false }))
                            }
                            className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#3d5270] hover:bg-[#e4eef8] cursor-pointer"
                          >
                            Cerrar
                          </button>
                          <button
                            type="button"
                            disabled={saving || !draft.title.trim()}
                            onClick={() => void createItem(block._id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Agregar
                          </button>
                        </div>
                      </div>
                      <StatusButtons
                        value={draft.status}
                        disabled={saving}
                        onChange={(status) => setDraft({ status })}
                      />
                    </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setComposerOpen((prev) => ({ ...prev, [block._id]: true }))
                        }
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#c5d4e8] bg-[#f4f8fc] px-3 py-2 text-sm font-medium text-[#1d4e89] hover:bg-[#e4eef8] cursor-pointer"
                      >
                        <Plus className="h-4 w-4" />
                        Nueva tarea
                      </button>
                    )}
                  </section>
                );
              })}
              </div>
            </div>

            <div className="flex gap-2 border-t border-[#b7cce4] bg-[#d5e4f4] px-5 py-4">
              <input
                value={newBlockName}
                onChange={(event) => setNewBlockName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createBlock();
                  }
                }}
                placeholder="Nuevo bloque"
                className="min-w-0 flex-1 rounded-lg border border-[#c5d4e8] bg-white px-3 py-2 text-sm text-[#0f2744]"
              />
              <button
                type="button"
                disabled={saving || !newBlockName.trim()}
                onClick={() => void createBlock()}
                className="inline-flex items-center gap-1 rounded-lg bg-[#1d4e89] px-3 py-2 text-sm font-semibold text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Bloque
              </button>
            </div>
          </article>
          {taskToDelete ? (
            <ConfirmDeleteDialog
              title="Eliminar tarea"
              name={taskToDelete.title}
              busy={saving}
              onCancel={() => setTaskToDelete(null)}
              onConfirm={() => void removeItem(taskToDelete)}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}
