"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ListChecks, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  newRutinaPasoId,
  RUTINA_MAX_TEXTO,
  splitRutinaPaso,
  type RutinaPaso,
} from "@/app/admin92/erp/lib/erpRutina";

export default function ErpRutina() {
  const [open, setOpen] = useState(false);
  const [pasos, setPasos] = useState<RutinaPaso[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  /** Copia que se edita; null = modo vista */
  const [draft, setDraft] = useState<RutinaPaso[] | null>(null);
  const [newText, setNewText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Cada vez que se abre: carga la rutina y arranca en modo vista
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setNewText("");
    setError("");
    setLoading(true);
    const controller = new AbortController();
    fetch("/api/admin/erp-rutina", { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const data = (await res.json()) as { pasos?: RutinaPaso[]; error?: string };
        if (!res.ok) throw new Error(data.error || "No se pudo cargar la rutina.");
        setPasos(Array.isArray(data.pasos) ? data.pasos : []);
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No se pudo cargar la rutina.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [open]);

  const updateDraft = (fn: (prev: RutinaPaso[]) => RutinaPaso[]) =>
    setDraft((prev) => (prev ? fn(prev) : prev));

  const move = (index: number, delta: number) =>
    updateDraft((prev) => {
      const target = index + delta;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addPaso = () => {
    const text = newText.trim();
    if (!text) return;
    updateDraft((prev) => [...prev, { id: newRutinaPasoId(), text }]);
    setNewText("");
  };

  const save = async () => {
    if (!draft) return;
    // Lo escrito en "Agregar paso" sin confirmar también se guarda
    const pending = newText.trim();
    const body = (pending ? [...draft, { id: newRutinaPasoId(), text: pending }] : draft)
      .map((p) => ({ ...p, text: p.text.trim() }))
      .filter((p) => p.text);
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/erp-rutina", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pasos: body }),
      });
      const data = (await res.json()) as { pasos?: RutinaPaso[]; error?: string };
      if (!res.ok) throw new Error(data.error || "No se pudo guardar la rutina.");
      setPasos(Array.isArray(data.pasos) ? data.pasos : body);
      setDraft(null);
      setNewText("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la rutina.");
    } finally {
      setSaving(false);
    }
  };

  const iconButton =
    "shrink-0 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition cursor-pointer"
      >
        <ListChecks className="h-4 w-4" />
        Rutina
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
            aria-labelledby="erp-rutina-title"
            className="max-h-[min(40rem,90vh)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="erp-rutina-title" className="text-lg font-semibold text-slate-950">
                Rutina
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            {loading ? (
              <p className="py-6 text-center text-sm text-slate-500">Cargando…</p>
            ) : draft ? (
              /* Edición: textos, orden, quitar y sumar; se guarda todo junto */
              <div>
                <ol className="space-y-2">
                  {draft.map((paso, index) => (
                    <li key={paso.id} className="flex items-start gap-1.5">
                      <span className="mt-1.5 w-5 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">
                        {index + 1}.
                      </span>
                      {/* Crece con el texto para editar pasos largos en el celular; Enter no agrega líneas */}
                      <textarea
                        rows={1}
                        value={paso.text}
                        maxLength={RUTINA_MAX_TEXTO}
                        disabled={saving}
                        onChange={(e) =>
                          updateDraft((prev) =>
                            prev.map((p) =>
                              p.id === paso.id ? { ...p, text: e.target.value.replace(/\n/g, " ") } : p,
                            ),
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.preventDefault();
                        }}
                        aria-label={`Paso ${index + 1}`}
                        className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm leading-snug text-slate-900 outline-none [field-sizing:content] focus:border-slate-400"
                      />
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={saving || index === 0}
                        aria-label="Subir paso"
                        className={iconButton}
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={saving || index === draft.length - 1}
                        aria-label="Bajar paso"
                        className={iconButton}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateDraft((prev) => prev.filter((p) => p.id !== paso.id))}
                        disabled={saving}
                        aria-label="Quitar paso"
                        className={`${iconButton} hover:text-rose-600`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ol>

                <div className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-2.5 py-1">
                  <Plus className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <input
                    type="text"
                    value={newText}
                    maxLength={RUTINA_MAX_TEXTO}
                    disabled={saving}
                    onChange={(e) => setNewText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPaso();
                      }
                    }}
                    placeholder="Agregar paso…"
                    aria-label="Nuevo paso"
                    className="min-w-0 flex-1 border-0 bg-transparent py-1 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                  />
                  {newText.trim() ? (
                    <button
                      type="button"
                      onClick={addPaso}
                      disabled={saving}
                      className="shrink-0 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
                    >
                      Agregar
                    </button>
                  ) : null}
                </div>

                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(null);
                      setNewText("");
                      setError("");
                    }}
                    disabled={saving}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
                  >
                    {saving ? "Guardando…" : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              /* Vista: lista numerada; "Título: detalle" con el título en negrita */
              <div>
                {pasos.length === 0 ? (
                  <p className="py-4 text-center text-sm text-slate-500">
                    Todavía no hay pasos. Tocá Editar para armar tu rutina.
                  </p>
                ) : (
                  <ol className="space-y-2.5">
                    {pasos.map((paso, index) => {
                      const { title, detail } = splitRutinaPaso(paso.text);
                      return (
                        <li key={paso.id} className="flex gap-2.5 text-sm leading-relaxed text-slate-700">
                          <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-slate-400">
                            {index + 1}.
                          </span>
                          <span>
                            {title ? (
                              <>
                                <strong className="font-semibold text-slate-900">{title}:</strong>{" "}
                              </>
                            ) : null}
                            {detail}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                {!error ? (
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(pasos.map((p) => ({ ...p })));
                        setError("");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  </div>
                ) : null}
              </div>
            )}

            {/* No fumar: el texto de siempre, en segundo plano */}
            <details className="group mt-6 border-t border-slate-100 pt-4">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-slate-500 [&::-webkit-details-marker]:hidden">
                <ChevronDown className="h-4 w-4 -rotate-90 transition-transform group-open:rotate-0" />
                No fumar
              </summary>
              <div className="mt-3 space-y-4 text-sm leading-relaxed text-slate-700">
                <p className="font-semibold text-slate-900">
                  El mayor riesgo que atenta contra mi sueño.
                </p>
                <p>
                  <strong className="font-semibold text-slate-900">
                    El consumo regular de marihuana ralentiza las reacciones físicas y mentales
                  </strong>
                  , afecta la concentración y daña la memoria a corto plazo, lo que disminuye la
                  capacidad de aprendizaje (especialmente en menores de 25 años). Además, altera la
                  dopamina en el cerebro, lo que provoca{" "}
                  <strong className="font-semibold text-slate-900">
                    cambios bruscos de humor, ansiedad y el llamado &quot;síndrome amotivacional&quot;
                  </strong>
                  , una apatía generalizada que quita el interés por el estudio, el trabajo y las
                  metas personales.
                </p>
                <p>
                  Recordemos que la voluntad es eficaz sobre las conductas, no sobre la química. Y
                  es a nivel químico que hay que entender que las cosas se han cambiado de manera
                  irreversible si el consumo ha afectado zonas específicas del cerebro. Es decir,
                  que lo que hace difícil{" "}
                  <a
                    href="https://www.centrobonanova.com/tratamientos/cannabis/"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Dejar cannabis"
                    className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2"
                  >
                    dejar el cannabis
                  </a>{" "}
                  se produce por modificaciones a nivel químico.
                </p>
              </div>
            </details>
          </article>
        </div>
      ) : null}
    </>
  );
}
