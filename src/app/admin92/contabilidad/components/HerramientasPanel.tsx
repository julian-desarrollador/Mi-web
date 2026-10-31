"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText } from "lucide-react";
import type { HerramientaSection } from "@/app/lib/contabilidadHerramientasMongo";

export type HerramientaNota = {
  _id: string;
  section: HerramientaSection;
  monthKey?: string;
  text: string;
  createdAt: string;
  updatedAt?: string;
};

type Props = {
  section: HerramientaSection;
  title: string;
  hint: string;
  /** Solo objetivos: mes YYYY-MM del calendario */
  monthKey?: string;
  monthLabel?: string;
  wordOnlineUrl?: string;
};

function formatNotaDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function HerramientasPanel({
  section,
  title,
  hint,
  monthKey,
  monthLabel,
  wordOnlineUrl,
}: Props) {
  const [notas, setNotas] = useState<HerramientaNota[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchNotas = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ section });
      if (section === "objetivos" && monthKey) params.set("month", monthKey);
      const res = await fetch(`/api/admin/contabilidad-herramientas?${params}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudieron cargar las notas.");
        return;
      }
      const list = Array.isArray(data?.notas) ? data.notas : [];
      setNotas(
        list.map((n: HerramientaNota & { _id?: string }) => ({
          ...n,
          _id: n._id || "",
          createdAt: typeof n.createdAt === "string" ? n.createdAt : new Date(n.createdAt).toISOString(),
        })),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error de red.");
    } finally {
      setLoading(false);
    }
  }, [section, monthKey]);

  useEffect(() => {
    fetchNotas();
  }, [fetchNotas]);

  useEffect(() => {
    setShowAddForm(false);
    setDraft("");
  }, [section, monthKey]);

  const handleAdd = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/contabilidad-herramientas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section,
          text,
          ...(section === "objetivos" && monthKey ? { monthKey } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo guardar.");
        return;
      }
      setDraft("");
      setShowAddForm(false);
      await fetchNotas();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar esta nota?")) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/contabilidad-herramientas/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo eliminar.");
        return;
      }
      if (editingId === id) {
        setEditingId(null);
        setEditText("");
      }
      await fetchNotas();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al eliminar.");
    }
  };

  const handleSaveEdit = async (id: string) => {
    const text = editText.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/contabilidad-herramientas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "No se pudo actualizar.");
        return;
      }
      setEditingId(null);
      setEditText("");
      await fetchNotas();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al actualizar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div className="mb-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {wordOnlineUrl ? (
            <a
              href={wordOnlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 transition-colors"
            >
              <FileText className="h-4 w-4 shrink-0 text-[#84b9ed]" aria-hidden />
              Word online
            </a>
          ) : null}
        </div>
        {section === "objetivos" && monthLabel && (
          <p className="text-xs text-slate-500 mt-0.5">Mes: {monthLabel}</p>
        )}
        <p className="text-xs text-slate-600 mt-1">{hint}</p>
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Cargando notas...</p>
      ) : notas.length === 0 ? (
        <p className="text-sm text-slate-500 italic mb-3">Sin notas todavía.</p>
      ) : (
        <ul className="space-y-2 mb-3">
          {notas.map((n) => (
            <li
              key={n._id}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-800"
            >
              {editingId === n._id ? (
                <div className="space-y-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent resize-y"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(n._id)}
                      disabled={saving || !editText.trim()}
                      className="rounded-lg bg-[#84b9ed] px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(null);
                        setEditText("");
                      }}
                      className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{n.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{formatNotaDate(n.updatedAt || n.createdAt)}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(n._id);
                        setEditText(n.text);
                      }}
                      className="font-medium text-[#4a7fb8] hover:underline cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(n._id)}
                      className="font-medium text-red-600 hover:underline cursor-pointer"
                    >
                      Eliminar
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {showAddForm ? (
        <div className="space-y-2 pt-3 border-t border-slate-200">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Escribí una nota, objetivo, recordatorio..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent resize-y min-h-[4.5rem]"
            autoFocus
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAdd}
              disabled={saving || !draft.trim()}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer ${
                saving || !draft.trim()
                  ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                  : "bg-[#84b9ed] text-white"
              }`}
            >
              {saving ? "Guardando..." : "Agregar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setDraft("");
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
        >
          Agregar nota
        </button>
      )}
    </div>
  );
}
