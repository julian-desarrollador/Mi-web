"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, StickyNote, Trash2, X } from "lucide-react";
import { formatLocalDate } from "@/app/admin92/contabilidad/lib/utils";
import { sortErpObservations, type ErpObservation } from "@/app/admin92/erp/lib/erpObservations";

function previewText(text: string): string {
  const first = text.trim().split("\n")[0] ?? "";
  if (first.length <= 140) return first;
  return `${first.slice(0, 140).trim()}…`;
}

export default function ErpObservations() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ErpObservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"list" | "create" | "edit" | "view">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [notedOn, setNotedOn] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (mode !== "list") {
          setMode("list");
          return;
        }
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open]);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/erp-observations", { cache: "no-store" });
      const data = (await response.json()) as {
        observations?: ErpObservation[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error || "No se pudieron cargar las observaciones.");
      }
      setItems(data.observations ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las observaciones.");
    } finally {
      setLoading(false);
    }
  };

  const startCreate = () => {
    setEditingId(null);
    setViewingId(null);
    setText("");
    setNotedOn("");
    setMode("create");
    setError(null);
  };

  const startView = (item: ErpObservation) => {
    setViewingId(item._id);
    setEditingId(null);
    setText(item.text);
    setNotedOn(item.notedOn ?? "");
    setMode("view");
    setError(null);
  };

  const startEdit = (item: ErpObservation, fromView = false) => {
    setEditingId(item._id);
    if (!fromView) setViewingId(null);
    setText(item.text);
    setNotedOn(item.notedOn ?? "");
    setMode("edit");
    setError(null);
  };

  const cancelForm = () => {
    if (mode === "edit" && viewingId) {
      const current = items.find((item) => item._id === viewingId);
      if (current) {
        startView(current);
        return;
      }
    }
    setMode("list");
    setEditingId(null);
    setViewingId(null);
    setText("");
  };

  const viewingItem =
    viewingId != null ? items.find((item) => item._id === viewingId) ?? null : null;

  const handleSave = async () => {
    const payload = { text: text.trim(), notedOn: notedOn.trim() || null };
    if (!payload.text) {
      setError("El texto es requerido.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const isEdit = mode === "edit" && editingId;
      const response = await fetch(
        isEdit ? `/api/admin/erp-observations/${editingId}` : "/api/admin/erp-observations",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as {
        observation?: ErpObservation;
        error?: string;
      };
      if (!response.ok || !data.observation) {
        throw new Error(data.error || "No se pudo guardar la observación.");
      }
      setItems((prev) => {
        const next = isEdit
          ? prev.map((item) => (item._id === editingId ? data.observation! : item))
          : [data.observation!, ...prev];
        return sortErpObservations(next);
      });
      if (isEdit && viewingId && data.observation) {
        setText(data.observation.text);
        setNotedOn(data.observation.notedOn ?? "");
        setEditingId(null);
        setMode("view");
      } else {
        setMode("list");
        setEditingId(null);
        setViewingId(null);
        setText("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la observación.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ErpObservation) => {
    const ok = window.confirm("¿Eliminar esta observación?");
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/erp-observations/${item._id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "No se pudo eliminar la observación.");
      }
      setItems((prev) => prev.filter((row) => row._id !== item._id));
      if (editingId === item._id) cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar la observación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setMode("list");
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition cursor-pointer"
      >
        <StickyNote className="h-4 w-4" />
        Observaciones
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="erp-observations-title"
            className="flex max-h-[min(40rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <h2 id="erp-observations-title" className="text-lg font-semibold text-slate-950">
                Observaciones
              </h2>
              <div className="flex items-center gap-1">
                {mode === "list" ? (
                  <button
                    type="button"
                    onClick={startCreate}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="rounded-lg p-1.5 text-slate-400 transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {error ? (
                <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </p>
              ) : null}

              {mode === "view" && viewingItem ? (
                <div className="space-y-4">
                  <p className="text-xs font-semibold text-slate-500">
                    {viewingItem.notedOn ? formatLocalDate(viewingItem.notedOn) : "Sin fecha"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {viewingItem.text}
                  </p>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMode("list");
                        setViewingId(null);
                      }}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 cursor-pointer"
                    >
                      Volver
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(viewingItem, true)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  </div>
                </div>
              ) : mode === "create" || mode === "edit" ? (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSave();
                  }}
                >
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Fecha (opcional)
                    </label>
                    <input
                      type="date"
                      value={notedOn}
                      onChange={(event) => setNotedOn(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      Observación
                    </label>
                    <textarea
                      required
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      rows={6}
                      placeholder="Un patrón, una idea, algo que notaste…"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelForm}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 cursor-pointer"
                    >
                      {saving ? "Guardando…" : mode === "edit" ? "Guardar" : "Agregar"}
                    </button>
                  </div>
                </form>
              ) : loading ? (
                <p className="text-sm text-slate-500">Cargando…</p>
              ) : items.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-500">Todavía no hay observaciones</p>
                  <button
                    type="button"
                    onClick={startCreate}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Agregar
                  </button>
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item._id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-slate-500">
                          {item.notedOn ? formatLocalDate(item.notedOn) : "Sin fecha"}
                        </p>
                        <div className="flex shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            aria-label="Editar observación"
                            className="rounded-lg p-1.5 text-slate-400 cursor-pointer"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item)}
                            aria-label="Eliminar observación"
                            className="rounded-lg p-1.5 text-slate-400 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <p
                        className="mt-1 cursor-pointer whitespace-pre-wrap text-sm leading-relaxed text-slate-800"
                        onClick={() => startView(item)}
                      >
                        {previewText(item.text)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
