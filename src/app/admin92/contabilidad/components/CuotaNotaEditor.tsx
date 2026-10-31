"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";

type Props = {
  cobroId: string;
  notes?: string;
  onSaved: () => void;
  compact?: boolean;
};

export default function CuotaNotaEditor({ cobroId, notes, onSaved, compact }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const openEditor = () => {
    setDraft(notes || "");
    setError("");
    setExpanded(true);
  };

  const closeEditor = () => {
    setExpanded(false);
    setDraft("");
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cobros/${cobroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: draft.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo guardar la nota.");
        return;
      }
      closeEditor();
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (expanded) {
    return (
      <div className={`${compact ? "mt-2" : "mt-1.5"} space-y-2`}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          placeholder="Nota sobre esta cuota..."
          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs sm:text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent resize-y"
          autoFocus
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#84b9ed] px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar nota"}
          </button>
          <button
            type="button"
            onClick={closeEditor}
            className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (notes?.trim()) {
    return (
      <div className={`${compact ? "mt-2" : "mt-1.5"}`}>
        <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-2.5 py-2 text-xs text-slate-700">
          <div className="flex items-start gap-1.5">
            <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
            <p className="whitespace-pre-wrap flex-1">{notes}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openEditor}
          className="mt-1 text-xs font-medium text-[#4a7fb8] hover:underline cursor-pointer"
        >
          Editar nota
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={openEditor}
      className={`inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-[#4a7fb8] cursor-pointer ${
        compact ? "mt-2" : "mt-1"
      }`}
    >
      <StickyNote className="h-3.5 w-3.5" aria-hidden />
      Agregar nota
    </button>
  );
}
