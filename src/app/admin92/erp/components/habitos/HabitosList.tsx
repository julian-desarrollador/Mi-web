"use client";

import type { KeyboardEvent } from "react";
import { ListChecks, Pencil, Trash2 } from "lucide-react";
import { HABITO_MAX, type ErpHabito } from "@/app/admin92/erp/lib/erpHabitos";
import { SectionHeader, SectionSkeleton, sectionCardClass } from "@/app/admin92/erp/components/habitos/SectionHeader";

function onComposerKeyDown(
  event: KeyboardEvent<HTMLTextAreaElement>,
  saving: boolean,
  onSave: () => void,
  onCancel: () => void,
) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    onCancel();
    return;
  }
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
    event.preventDefault();
    if (!saving) onSave();
  }
}

export function HabitosList({
  items,
  loading,
  saving,
  hasError,
  adding,
  draft,
  editingId,
  editDraft,
  onStartAdd,
  onCancelAdd,
  onDraft,
  onCreate,
  onStartEdit,
  onCancelEdit,
  onEditDraft,
  onSaveEdit,
  onRemove,
}: {
  items: ErpHabito[];
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  adding: boolean;
  draft: string;
  editingId: string | null;
  editDraft: string;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onDraft: (value: string) => void;
  onCreate: () => void;
  onStartEdit: (item: ErpHabito) => void;
  onCancelEdit: () => void;
  onEditDraft: (value: string) => void;
  onSaveEdit: () => void;
  onRemove: (item: ErpHabito) => void;
}) {
  const ordered = [...items].sort((a, b) => a.order - b.order);

  return (
    <section className={sectionCardClass} aria-busy={loading}>
      <SectionHeader
        icon={ListChecks}
        title="Hábitos"
        action={
          adding ? null : (
            <button
              type="button"
              onClick={onStartAdd}
              className="text-xs font-semibold text-[#1d4e89] cursor-pointer"
            >
              + Agregar hábito
            </button>
          )
        }
      />
      {adding ? (
        <div className="mt-3 space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={(event) => onDraft(event.target.value.slice(0, HABITO_MAX))}
            onKeyDown={(event) => onComposerKeyDown(event, saving, onCreate, onCancelAdd)}
            rows={3}
            maxLength={HABITO_MAX}
            placeholder="Un hábito nuevo…"
            aria-label="Nuevo hábito"
            className="w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-2 text-sm text-[#0f2744] placeholder:text-[#3d5270]"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={saving || !draft.trim()}
              onClick={onCreate}
              className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              Agregar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={onCancelAdd}
              className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0f2744] cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}
      {loading ? <SectionSkeleton /> : null}
      {!loading && ordered.length === 0 && !hasError ? (
        <p className="mt-3 text-sm text-[#3d5270]">Todavía no hay hábitos.</p>
      ) : null}
      {!loading && ordered.length > 0 ? (
        <ol className="mt-2">
          {ordered.map((item, index) => (
            <li key={item._id} className="group border-t border-[#e4eef8] py-2.5 first:border-t-0">
              {editingId === item._id ? (
                <div className="space-y-2">
                  <textarea
                    autoFocus
                    value={editDraft}
                    onChange={(event) => onEditDraft(event.target.value.slice(0, HABITO_MAX))}
                    onKeyDown={(event) => onComposerKeyDown(event, saving, onSaveEdit, onCancelEdit)}
                    rows={4}
                    maxLength={HABITO_MAX}
                    aria-label="Editar hábito"
                    className="w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-2 text-sm text-[#0f2744]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={saving || !editDraft.trim()}
                      onClick={onSaveEdit}
                      className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={onCancelEdit}
                      className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0f2744] cursor-pointer disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <span className="w-5 shrink-0 text-sm font-semibold tabular-nums text-[#1d4e89]">{index + 1}</span>
                  <p className="min-w-0 flex-1 whitespace-pre-wrap text-[15px] leading-relaxed text-[#0f2744]">
                    {item.text}
                  </p>
                  <div className="flex shrink-0 gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
                    <button
                      type="button"
                      aria-label="Editar hábito"
                      disabled={saving}
                      onClick={() => onStartEdit(item)}
                      className="rounded-lg p-1.5 text-[#3d5270] cursor-pointer disabled:opacity-50"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Eliminar hábito"
                      disabled={saving}
                      onClick={() => onRemove(item)}
                      className="rounded-lg p-1.5 text-[#3d5270] cursor-pointer disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
