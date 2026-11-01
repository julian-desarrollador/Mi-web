"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Package, Pencil, Plus, Trash2, X } from "lucide-react";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import {
  comparePendientes,
  entregaEstado,
  formatUpdateFecha,
  formatUpdateInstant,
  localHm,
  localYmd,
  mapErpUpdate,
  type EntregaEstado,
  type ErpUpdate,
} from "@/app/admin92/erp/lib/erpUpdates";

type Props = {
  onClose: () => void;
  /** Cantidad de updates pendientes después de cada carga (badge del 📦) */
  onCountChange?: (count: number) => void;
  /** Proyectos sugeridos (clientes de las cuotas) */
  proyectoSuggestions?: string[];
};

type FormValues = {
  proyecto: string;
  nota: string;
  listaFecha: string;
  listaHora: string;
  entregaFecha: string;
  entregaHora: string;
};

type FormMode = { kind: "new" } | { kind: "edit"; id: string };

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-transparent focus:ring-2 focus:ring-[#84b9ed]";

const ENTREGA_CHIP: Record<EntregaEstado, string> = {
  entregada: "bg-emerald-50 text-emerald-700 border-emerald-200",
  atrasada: "bg-rose-50 text-rose-700 border-rose-200",
  hoy: "bg-amber-50 text-amber-800 border-amber-200",
  planeada: "bg-blue-50 text-blue-700 border-blue-200",
  "sin-fecha": "bg-slate-50 text-slate-500 border-slate-200",
};

function emptyValues(proyecto = ""): FormValues {
  return {
    proyecto,
    nota: "",
    listaFecha: localYmd(),
    listaHora: localHm(),
    entregaFecha: "",
    entregaHora: "",
  };
}

function valuesFrom(u: ErpUpdate): FormValues {
  return {
    proyecto: u.proyecto,
    nota: u.nota,
    listaFecha: u.listaFecha,
    listaHora: u.listaHora ?? "",
    entregaFecha: u.entregaFecha ?? "",
    entregaHora: u.entregaHora ?? "",
  };
}

/** Modal de updates listas para entregar: pensado para leer primero; alta/edición a un clic. */
export default function ErpUpdatesModal({ onClose, onCountChange, proyectoSuggestions = [] }: Props) {
  const [updates, setUpdates] = useState<ErpUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [initialValues, setInitialValues] = useState<FormValues>(emptyValues);
  const [showEntregadas, setShowEntregadas] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const today = localYmd();

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/erp-updates", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar las updates.");
      const list: ErpUpdate[] = Array.isArray(data.updates) ? data.updates.map(mapErpUpdate) : [];
      setUpdates(list);
      onCountChange?.(list.filter((u) => !u.entregada).length);
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const formDirty = formMode !== null && JSON.stringify(values) !== JSON.stringify(initialValues);

  // Al abrir, el foco va a cerrar (no a un campo): se entra a leer
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Escape: con formulario abierto y algo escrito no hace nada (no se pierde lo escrito);
  // con formulario sin cambios lo cierra; si no hay formulario, cierra el modal.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (formMode) {
        if (!formDirty) setFormMode(null);
        return;
      }
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, formMode, formDirty]);

  // Resaltar la recién creada un instante
  useEffect(() => {
    if (!highlightId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`erp-update-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    const t = window.setTimeout(() => setHighlightId(null), 2200);
    return () => window.clearTimeout(t);
  }, [highlightId]);

  const pendientes = useMemo(() => updates.filter((u) => !u.entregada).sort(comparePendientes), [updates]);
  const entregadas = useMemo(
    () =>
      updates
        .filter((u) => u.entregada)
        .sort((a, b) => (b.entregadaAt ?? "").localeCompare(a.entregadaAt ?? "")),
    [updates],
  );

  /** Grupos por proyecto; el proyecto con la entrega más urgente primero. */
  const grupos = useMemo(() => {
    const map = new Map<string, ErpUpdate[]>();
    for (const u of pendientes) map.set(u.proyecto, [...(map.get(u.proyecto) ?? []), u]);
    return Array.from(map.entries());
  }, [pendientes]);

  const suggestions = useMemo(
    () =>
      Array.from(new Set([...proyectoSuggestions, ...updates.map((u) => u.proyecto)].filter(Boolean))).sort(
        (a, b) => a.localeCompare(b, "es"),
      ),
    [proyectoSuggestions, updates],
  );

  /** fetch JSON con manejo de error uniforme; devuelve el JSON si salió bien. */
  const send = async (url: string, method: string, body?: unknown): Promise<Record<string, unknown> | null> => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No se pudo guardar.");
      await load();
      return data;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
      await load();
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openNew = () => {
    // Si hay un solo proyecto con pendientes, se sugiere ese
    const v = emptyValues(grupos.length === 1 ? grupos[0][0] : "");
    setValues(v);
    setInitialValues(v);
    setFormMode({ kind: "new" });
    setError("");
  };

  const openEdit = (u: ErpUpdate) => {
    const v = valuesFrom(u);
    setValues(v);
    setInitialValues(v);
    setFormMode({ kind: "edit", id: u.id });
    setError("");
  };

  const setValue = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formMode) return;
    if (!values.proyecto.trim() || !values.nota.trim()) {
      setError("Completá el proyecto y la nota del update.");
      return;
    }
    if (!values.listaFecha) {
      setError("Elegí la fecha en que quedó lista.");
      return;
    }
    const body = { ...values };
    if (formMode.kind === "edit") {
      const ok = await send(`/api/admin/erp-updates/${formMode.id}`, "PATCH", body);
      if (ok) setFormMode(null);
      return;
    }
    const data = await send("/api/admin/erp-updates", "POST", body);
    if (data) {
      setFormMode(null);
      if (typeof data.id === "string") setHighlightId(data.id);
    }
  };

  const toggleEntregada = (u: ErpUpdate) => {
    const next = !u.entregada;
    // Optimista: se mueve de sección al instante
    setUpdates((prev) =>
      prev.map((x) =>
        x.id === u.id ? { ...x, entregada: next, entregadaAt: next ? new Date().toISOString() : undefined } : x,
      ),
    );
    void send(`/api/admin/erp-updates/${u.id}`, "PATCH", { entregada: next });
  };

  const handleDelete = async (u: ErpUpdate) => {
    if (!window.confirm(`¿Quitar la update de "${u.proyecto}"?`)) return;
    await send(`/api/admin/erp-updates/${u.id}`, "DELETE");
    if (formMode?.kind === "edit" && formMode.id === u.id) setFormMode(null);
  };

  /* ---------- Formulario (alta y edición) ---------- */
  const renderForm = () => (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-3 rounded-xl border border-[#84b9ed]/50 bg-[#84b9ed]/5 p-3"
    >
      <p className="text-sm font-semibold text-slate-800">
        {formMode?.kind === "edit" ? "Editar update" : "Nueva update"}
      </p>
      <label className="block text-xs font-medium text-slate-600">
        Proyecto
        <input
          type="text"
          list={listId}
          value={values.proyecto}
          onChange={(e) => setValue("proyecto", e.target.value)}
          placeholder="Elegí o escribí el proyecto"
          className={`mt-1 ${INPUT}`}
        />
      </label>
      <label className="block text-xs font-medium text-slate-600">
        Nota del update
        <textarea
          value={values.nota}
          onChange={(e) => setValue("nota", e.target.value)}
          rows={3}
          placeholder="Qué está listo para entregar…"
          className={`mt-1 resize-y ${INPUT}`}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-slate-600">Lista</legend>
          <div className="flex gap-2">
            <DatePickerField
              value={values.listaFecha}
              onChange={(v) => setValue("listaFecha", v)}
              aria-label="Fecha en que quedó lista"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="time"
              value={values.listaHora}
              onChange={(e) => setValue("listaHora", e.target.value)}
              aria-label="Hora en que quedó lista (opcional)"
              className="w-[6.5rem] rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
            />
          </div>
        </fieldset>
        <fieldset className="space-y-1">
          <legend className="text-xs font-medium text-slate-600">Entrega planeada (opcional)</legend>
          <div className="flex gap-2">
            <DatePickerField
              value={values.entregaFecha}
              onChange={(v) => setValues((prev) => ({ ...prev, entregaFecha: v, ...(v ? {} : { entregaHora: "" }) }))}
              allowClear
              placeholder="Sin fecha"
              aria-label="Fecha de entrega planeada"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="time"
              value={values.entregaHora}
              onChange={(e) => setValue("entregaHora", e.target.value)}
              disabled={!values.entregaFecha}
              aria-label="Hora de entrega (opcional)"
              className="w-[6.5rem] rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm disabled:opacity-40"
            />
          </div>
        </fieldset>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#84b9ed] px-4 py-2 text-sm font-semibold text-white cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
        >
          {saving ? "Guardando…" : formMode?.kind === "edit" ? "Guardar" : "Agregar"}
        </button>
        <button
          type="button"
          onClick={() => setFormMode(null)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </form>
  );

  /* ---------- Tarjeta de lectura ---------- */
  const renderCard = (u: ErpUpdate, showProyecto: boolean) => {
    if (formMode?.kind === "edit" && formMode.id === u.id) {
      return <li key={u.id}>{renderForm()}</li>;
    }
    const estado = entregaEstado(u, today);
    const highlighted = highlightId === u.id;
    return (
      <li
        key={u.id}
        id={`erp-update-${u.id}`}
        className={`group flex items-start gap-3 rounded-xl border bg-white p-3 transition-shadow ${
          highlighted ? "border-[#84b9ed] ring-2 ring-[#84b9ed]/40" : "border-slate-200"
        } ${u.entregada ? "opacity-70" : ""}`}
      >
        <button
          type="button"
          role="checkbox"
          aria-checked={u.entregada}
          onClick={() => toggleEntregada(u)}
          title={u.entregada ? "Marcar como pendiente" : "Marcar como entregada"}
          aria-label={u.entregada ? "Marcar como pendiente" : "Marcar como entregada"}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors cursor-pointer ${
            u.entregada
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 bg-white text-transparent hover:border-emerald-400"
          }`}
        >
          <Check className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          {showProyecto ? <p className="text-xs font-semibold text-slate-500">{u.proyecto}</p> : null}
          <p
            className={`whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800 ${
              u.entregada ? "line-through decoration-slate-300" : ""
            }`}
          >
            {u.nota}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-600">
              Lista: {formatUpdateFecha(u.listaFecha, u.listaHora)}
            </span>
            {u.entregada ? (
              <span className={`rounded-full border px-2 py-0.5 ${ENTREGA_CHIP.entregada}`}>
                Entregada{u.entregadaAt ? ` el ${formatUpdateInstant(u.entregadaAt)}` : ""}
                {u.entregaFecha ? ` · plan: ${formatUpdateFecha(u.entregaFecha, u.entregaHora)}` : ""}
              </span>
            ) : (
              <span className={`rounded-full border px-2 py-0.5 ${ENTREGA_CHIP[estado]}`}>
                {u.entregaFecha
                  ? `Entrega: ${formatUpdateFecha(u.entregaFecha, u.entregaHora)}${
                      estado === "atrasada" ? " · atrasada" : estado === "hoy" ? " · hoy" : ""
                    }`
                  : "Entrega: sin fecha"}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center opacity-60 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => openEdit(u)}
            disabled={saving}
            title="Editar"
            aria-label={`Editar update de ${u.proyecto}`}
            className="rounded-lg p-1.5 text-slate-500 hover:text-[#84b9ed] cursor-pointer disabled:opacity-50"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void handleDelete(u)}
            disabled={saving}
            title="Quitar"
            aria-label={`Quitar update de ${u.proyecto}`}
            className="rounded-lg p-1.5 text-slate-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !formDirty) onClose();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="erp-updates-title"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <h2 id="erp-updates-title" className="inline-flex min-w-0 items-center gap-2 text-lg font-semibold text-slate-950">
            <Package className="h-5 w-5 shrink-0 text-slate-500" />
            <span className="truncate">Updates para entregar</span>
            {pendientes.length > 0 ? (
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 text-xs font-semibold leading-[20px] text-slate-700">
                {pendientes.length}
              </span>
            ) : null}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {formMode?.kind !== "new" ? (
              <button
                type="button"
                onClick={openNew}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                Nueva
              </button>
            ) : null}
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-slate-400 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-5">
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
          ) : null}

          {formMode?.kind === "new" ? renderForm() : null}

          {/* Pendientes, agrupadas por proyecto */}
          {loading ? (
            <p className="py-8 text-center text-sm text-slate-500">Cargando updates…</p>
          ) : pendientes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No hay updates pendientes de entrega.
              {formMode ? null : (
                <>
                  {" "}
                  <button type="button" onClick={openNew} className="font-semibold text-[#4a7fb8] cursor-pointer">
                    Agregar una
                  </button>
                </>
              )}
            </p>
          ) : (
            grupos.map(([proyecto, items]) => (
              <section key={proyecto}>
                <h3 className="mb-2 flex items-baseline gap-2 text-sm font-bold text-slate-900">
                  {proyecto}
                  <span className="text-xs font-medium text-slate-400">
                    {items.length} update{items.length === 1 ? "" : "s"}
                  </span>
                </h3>
                <ul className="space-y-2">{items.map((u) => renderCard(u, false))}</ul>
              </section>
            ))
          )}

          {/* Entregadas, plegadas */}
          {entregadas.length > 0 ? (
            <section className="border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowEntregadas((v) => !v)}
                aria-expanded={showEntregadas}
                className="inline-flex items-center gap-1 text-sm font-semibold text-slate-500 cursor-pointer"
              >
                Entregadas ({entregadas.length})
                <ChevronDown className={`h-4 w-4 transition-transform ${showEntregadas ? "rotate-180" : ""}`} />
              </button>
              {showEntregadas ? (
                <ul className="mt-2 space-y-2">{entregadas.map((u) => renderCard(u, true))}</ul>
              ) : null}
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}
