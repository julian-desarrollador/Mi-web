"use client";

// Nota o recordatorio editable de un día del calendario de contabilidad.

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";
import { CALENDARIO_NOTA_MAX } from "@/app/admin92/contabilidad/lib/calendarioNotas";

type Props = {
  date: string;
  text: string;
  onSaved: (date: string, text: string) => void;
};

export default function CalendarioDiaNota({ date, text, onSaved }: Props) {
  const [draft, setDraft] = useState(text);
  const [open, setOpen] = useState(() => Boolean(text.trim()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDraft(text);
    setError("");
    setOpen(Boolean(text.trim()));
  }, [date, text]);

  const persist = async (next: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/calendario-notas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, text: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo guardar la nota.");
        return;
      }
      const saved = typeof data.text === "string" ? data.text : next.trim();
      setDraft(saved);
      onSaved(date, saved);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setDraft(text);
    setError("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(text);
          setError("");
          setOpen(true);
        }}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#1d4e89] hover:text-[#163d6b] cursor-pointer"
      >
        <StickyNote className="h-3.5 w-3.5" aria-hidden />
        Agregar recordatorio
      </button>
    );
  }

  const unchanged = draft.trim() === text.trim();

  return (
    <div className="mb-4 rounded-xl border border-[#c5d4e8] bg-white p-3">
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
        <StickyNote className="h-3.5 w-3.5 text-[#1d4e89]" aria-hidden />
        Recordatorio del día
      </label>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, CALENDARIO_NOTA_MAX))}
        rows={3}
        maxLength={CALENDARIO_NOTA_MAX}
        placeholder="Ej. Enviar recordatorio de pago a…"
        className="w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-2 text-sm text-slate-900 placeholder:text-[#3d5270] focus:border-[#84b9ed] focus:outline-none focus:ring-2 focus:ring-[#84b9ed]"
      />
      <p className="mt-1 text-[11px] text-[#3d5270]">
        {draft.length}/{CALENDARIO_NOTA_MAX}
      </p>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || unchanged}
          onClick={() => void persist(draft)}
          className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {text.trim() ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => void persist("")}
            className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 cursor-pointer disabled:opacity-50"
          >
            Quitar
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={cancel}
            className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
