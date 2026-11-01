"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, MessageCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { DESARROLLO50_SERVICIOS } from "@/app/admin92/contabilidad/lib/desarrollos50Labels";
import { mapDesarrollo50Doc, type Desarrollo50Item } from "@/app/admin92/contabilidad/lib/desarrollos50";
import {
  getPruebaDiasRestantes,
  getPruebaFin,
  LEAD_PRUEBA_LABEL,
  whatsappUrl,
  type LeadPrueba,
} from "@/app/admin92/contabilidad/lib/leads";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import Desarrollo50TasksBlock from "@/app/admin92/contabilidad/components/Desarrollo50TasksBlock";
import { formatLocalDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";

type Props = {
  onCountChange?: (count: number) => void;
  onAccountingChange?: () => void;
};

type View = { kind: "list" } | { kind: "detail"; id: string } | { kind: "form"; id?: string };

type FormState = {
  clientName: string;
  telefono: string;
  name: string;
  servicio: string;
  origen: string;
  prueba: "" | LeadPrueba;
  pruebaInicio: string;
  monto: string;
  fechaCobro: string;
};

const INPUT = "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800";

function formatArs(n: number) {
  return `$${n.toLocaleString("es-AR")} ARS`;
}

function isPaid(d: Desarrollo50Item): boolean {
  return d.montoCobrado50 !== undefined || Boolean(d.accountingRecordId);
}

function emptyForm(): FormState {
  return {
    clientName: "",
    telefono: "",
    name: "",
    servicio: "Web",
    origen: "",
    prueba: "",
    pruebaInicio: todayYmd(),
    monto: "",
    fechaCobro: todayYmd(),
  };
}

function formFromLead(d: Desarrollo50Item): FormState {
  return {
    ...emptyForm(),
    clientName: d.clientName,
    telefono: d.telefono ?? "",
    name: d.name,
    servicio: d.servicio ?? "",
    origen: d.origen ?? "",
    prueba: d.prueba ?? "",
    pruebaInicio: d.pruebaInicio ?? todayYmd(),
  };
}

/** Estado corto del lead para la lista: pagó, en prueba o sin pago. */
function leadStatus(d: Desarrollo50Item, today: string): { label: string; className: string } {
  if (isPaid(d)) {
    return { label: "1.er 50% pagado", className: "bg-emerald-100 text-emerald-800" };
  }
  if (d.prueba && d.pruebaInicio) {
    const dias = getPruebaDiasRestantes(d.prueba, d.pruebaInicio, today);
    if (dias < 0) return { label: "Prueba vencida", className: "bg-rose-100 text-rose-800" };
    if (dias === 0) return { label: "Prueba: vence hoy", className: "bg-amber-100 text-amber-800" };
    return {
      label: `Prueba: ${dias} día${dias === 1 ? "" : "s"}`,
      className: dias <= 3 ? "bg-amber-100 text-amber-800" : "bg-violet-100 text-violet-800",
    };
  }
  return { label: "Sin pago", className: "bg-slate-100 text-slate-600" };
}

/**
 * Leads: lista de personas (desarrollos 50% activos, con o sin 1.er pago, y pruebas gratis SaaS).
 * Tocar una persona abre su ficha; desde la lista se agregan, editan y quitan.
 */
export default function LeadsPanel({ onCountChange, onAccountingChange }: Props) {
  const [items, setItems] = useState<Desarrollo50Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>({ kind: "list" });
  const [form, setForm] = useState<FormState>(emptyForm);
  // Cobros desde la ficha
  const [cobroForm, setCobroForm] = useState<null | "inicial" | "final">(null);
  const [cobroFecha, setCobroFecha] = useState(todayYmd());
  const [cobroMonto, setCobroMonto] = useState("");
  const today = todayYmd();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/desarrollos-50", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar los leads.");
      const list: Desarrollo50Item[] = Array.isArray(data.desarrollos)
        ? data.desarrollos.map(mapDesarrollo50Doc)
        : [];
      list.sort((a, b) => a.clientName.localeCompare(b.clientName, "es"));
      setItems(list);
      onCountChange?.(list.length);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al cargar.");
    } finally {
      setLoading(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => (view.kind === "detail" ? items.find((d) => d.id === view.id) ?? null : null),
    [items, view],
  );
  const editing = useMemo(
    () => (view.kind === "form" && view.id ? items.find((d) => d.id === view.id) ?? null : null),
    [items, view],
  );

  const goList = () => {
    setView({ kind: "list" });
    setCobroForm(null);
    setError("");
  };

  const openForm = (lead?: Desarrollo50Item) => {
    setForm(lead ? formFromLead(lead) : emptyForm());
    setView({ kind: "form", id: lead?.id });
    setError("");
  };

  const openDetail = (lead: Desarrollo50Item) => {
    setView({ kind: "detail", id: lead.id });
    setCobroForm(null);
    setError("");
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** fetch JSON con manejo de error uniforme; devuelve true si salió bien. */
  const send = async (url: string, method: string, body?: unknown): Promise<boolean> => {
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
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim() || !form.name.trim()) {
      setError("La persona y el proyecto / negocio son requeridos.");
      return;
    }
    const common = {
      clientName: form.clientName.trim(),
      name: form.name.trim(),
      servicio: form.servicio,
      telefono: form.telefono,
      origen: form.origen,
      prueba: form.prueba || null,
      pruebaInicio: form.prueba ? form.pruebaInicio : null,
    };
    if (editing) {
      const ok = await send(`/api/admin/desarrollos-50/${editing.id}`, "PATCH", common);
      if (ok) setView({ kind: "detail", id: editing.id });
      return;
    }
    const monto = form.monto.trim();
    if (monto && (Number.isNaN(Number(monto)) || Number(monto) <= 0)) {
      setError("El monto del 1.er 50% debe ser un número positivo (o dejalo vacío).");
      return;
    }
    const ok = await send("/api/admin/desarrollos-50", "POST", {
      ...common,
      ...(monto ? { montoCobrado50: Number(monto), fechaCobro50: form.fechaCobro } : {}),
    });
    if (ok) {
      if (monto) onAccountingChange?.();
      setView({ kind: "list" });
    }
  };

  const handleDelete = async (lead: Desarrollo50Item) => {
    const lines = [`¿Quitar a "${lead.clientName} — ${lead.name}" de leads?`];
    if (isPaid(lead)) lines.push("", "También se borra el ingreso del 1.er 50%.");
    lines.push("Esta acción no se puede deshacer.");
    if (!window.confirm(lines.join("\n"))) return;
    const ok = await send(`/api/admin/desarrollos-50/${lead.id}`, "DELETE");
    if (!ok) return;
    if (isPaid(lead)) onAccountingChange?.();
    if (view.kind !== "list") setView({ kind: "list" });
  };

  const openCobro = (kind: "inicial" | "final", lead: Desarrollo50Item) => {
    setCobroForm(kind);
    setCobroFecha(todayYmd());
    setCobroMonto(kind === "final" && lead.montoCobrado50 !== undefined ? String(lead.montoCobrado50) : "");
    setError("");
  };

  const handleCobro = async (lead: Desarrollo50Item) => {
    const monto = Number(cobroMonto);
    if (Number.isNaN(monto) || monto <= 0) {
      setError("El monto debe ser un número positivo.");
      return;
    }
    const ok =
      cobroForm === "inicial"
        ? await send(`/api/admin/desarrollos-50/${lead.id}/cobrar-inicial`, "POST", {
            fechaCobro50: cobroFecha,
            montoCobrado50: monto,
          })
        : await send(`/api/admin/desarrollos-50/${lead.id}/cobrar-final`, "POST", {
            fechaCobro50Final: cobroFecha,
            montoCobrado50Final: monto,
          });
    if (!ok) return;
    onAccountingChange?.();
    // Con el 50% final el desarrollo se cierra y sale de leads
    if (cobroForm === "final") setView({ kind: "list" });
    setCobroForm(null);
  };

  const errorBox = error ? (
    <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>
  ) : null;

  /* ---------- Formulario: agregar / editar ---------- */
  if (view.kind === "form") {
    return (
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-2.5">
        <button
          type="button"
          onClick={() => (editing ? openDetail(editing) : goList())}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {editing ? editing.clientName : "Leads"}
        </button>
        <p className="text-sm font-semibold text-slate-900">{editing ? "Editar lead" : "Nuevo lead"}</p>
        {errorBox}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="text-[11px] font-medium text-slate-600">
            Persona *
            <input
              type="text"
              value={form.clientName}
              onChange={(e) => setField("clientName", e.target.value)}
              placeholder="Nombre y apellido"
              className={`mt-0.5 ${INPUT}`}
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Teléfono / WhatsApp
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => setField("telefono", e.target.value)}
              placeholder="+54 9 11 1234-5678"
              className={`mt-0.5 ${INPUT}`}
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Proyecto / negocio *
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Ej. Tienda de ropa"
              className={`mt-0.5 ${INPUT}`}
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Servicio
            <select
              value={form.servicio}
              onChange={(e) => setField("servicio", e.target.value)}
              className={`mt-0.5 cursor-pointer ${INPUT}`}
            >
              {editing && !form.servicio ? <option value="">—</option> : null}
              {DESARROLLO50_SERVICIOS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[11px] font-medium text-slate-600 sm:col-span-2">
            Origen
            <input
              type="text"
              value={form.origen}
              onChange={(e) => setField("origen", e.target.value)}
              placeholder="Ej. SaaS, Instagram, referido de Juan…"
              className={`mt-0.5 ${INPUT}`}
            />
          </label>
          <label className="text-[11px] font-medium text-slate-600">
            Prueba gratis
            <select
              value={form.prueba}
              onChange={(e) => setField("prueba", e.target.value as FormState["prueba"])}
              className={`mt-0.5 cursor-pointer ${INPUT}`}
            >
              <option value="">Sin prueba</option>
              <option value="14d">{LEAD_PRUEBA_LABEL["14d"]}</option>
              <option value="1m">{LEAD_PRUEBA_LABEL["1m"]}</option>
            </select>
          </label>
          {form.prueba ? (
            <label className="text-[11px] font-medium text-slate-600">
              Inicio de la prueba
              <DatePickerField
                value={form.pruebaInicio}
                onChange={(v) => setField("pruebaInicio", v)}
                aria-label="Inicio de la prueba"
                className={`mt-0.5 ${INPUT}`}
              />
            </label>
          ) : null}
          {!editing ? (
            <>
              <label className="text-[11px] font-medium text-slate-600">
                1.er 50% (opcional)
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.monto}
                  onChange={(e) => setField("monto", e.target.value)}
                  placeholder="Vacío si todavía no pagó"
                  className={`mt-0.5 ${INPUT}`}
                />
              </label>
              {form.monto.trim() ? (
                <label className="text-[11px] font-medium text-slate-600">
                  Fecha del cobro
                  <DatePickerField
                    value={form.fechaCobro}
                    onChange={(v) => setField("fechaCobro", v)}
                    aria-label="Fecha del 1.er 50%"
                    className={`mt-0.5 ${INPUT}`}
                  />
                </label>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
          >
            {saving ? "Guardando…" : editing ? "Guardar cambios" : form.monto.trim() ? "Agregar y registrar 1.er 50%" : "Agregar lead"}
          </button>
          <button
            type="button"
            onClick={() => (editing ? openDetail(editing) : goList())}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </form>
    );
  }

  /* ---------- Ficha de la persona ---------- */
  if (view.kind === "detail" && selected) {
    const d = selected;
    const wa = d.telefono ? whatsappUrl(d.telefono) : null;
    const status = leadStatus(d, today);
    const rows: { label: string; value: React.ReactNode }[] = [
      {
        label: "Teléfono",
        value: d.telefono ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {d.telefono}
            {wa ? (
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </a>
            ) : null}
          </span>
        ) : (
          "—"
        ),
      },
      { label: "Proyecto / negocio", value: d.name },
      { label: "Servicio", value: d.servicio || "—" },
      { label: "Origen", value: d.origen || "—" },
      {
        label: "Prueba gratis",
        value:
          d.prueba && d.pruebaInicio
            ? `${LEAD_PRUEBA_LABEL[d.prueba]} · del ${formatLocalDate(d.pruebaInicio)} al ${formatLocalDate(getPruebaFin(d.prueba, d.pruebaInicio))}`
            : "—",
      },
      {
        label: "1.er 50%",
        value: isPaid(d)
          ? `${d.montoCobrado50 !== undefined ? formatArs(d.montoCobrado50) : "Registrado"}${
              d.fechaCobro50 ? ` · el ${formatLocalDate(d.fechaCobro50)}` : ""
            }`
          : "Sin pago todavía",
      },
    ];

    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={goList}
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-800 cursor-pointer"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Leads
        </button>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{d.clientName}</p>
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
              {status.label}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => openForm(d)}
              disabled={saving}
              title="Editar"
              aria-label="Editar lead"
              className="rounded-md p-1.5 text-slate-500 hover:text-sky-700 cursor-pointer disabled:opacity-50"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(d)}
              disabled={saving}
              title="Quitar de leads"
              aria-label="Quitar de leads"
              className="rounded-md p-1.5 text-slate-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {errorBox}
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 rounded-md border border-sky-100 bg-white/90 p-2.5 text-xs sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="min-w-0">
              <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{row.label}</dt>
              <dd className="text-slate-800">{row.value}</dd>
            </div>
          ))}
        </dl>

        {cobroForm ? (
          <div className="flex flex-wrap items-end gap-2 rounded-md border border-sky-200 bg-white p-2.5">
            <p className="w-full text-xs font-semibold text-sky-900">
              {cobroForm === "inicial" ? "Registrar 1.er 50%" : "Cobrar 50% final (cierra el desarrollo)"}
            </p>
            <label className="text-[11px] text-slate-700">
              Fecha del cobro
              <DatePickerField
                value={cobroFecha}
                onChange={setCobroFecha}
                className="mt-0.5 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
              />
            </label>
            <label className="text-[11px] text-slate-700">
              Monto (ARS)
              <input
                type="number"
                min="1"
                step="0.01"
                value={cobroMonto}
                onChange={(e) => setCobroMonto(e.target.value)}
                className="mt-0.5 block w-28 rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleCobro(d)}
              className="rounded-md bg-sky-600 px-3 py-1.5 text-[11px] font-medium text-white cursor-pointer disabled:opacity-50"
            >
              {saving ? "Guardando…" : "Confirmar"}
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={() => setCobroForm(null)}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-[11px] text-slate-600 cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => openCobro(isPaid(d) ? "final" : "inicial", d)}
            className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white cursor-pointer disabled:opacity-50"
          >
            {isPaid(d) ? "Cobrar 50% final" : "Registrar 1.er 50%"}
          </button>
        )}

        <div className="border-t border-sky-100 pt-2">
          <Desarrollo50TasksBlock
            desarrollo={d}
            onUpdated={() => {
              void load();
              onAccountingChange?.();
            }}
          />
        </div>
      </div>
    );
  }

  /* ---------- Lista de personas ---------- */
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-sky-900">
          Leads{items.length > 0 ? ` (${items.length})` : ""}
        </p>
        <button
          type="button"
          onClick={() => openForm()}
          className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-medium text-sky-800 cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>
      {errorBox}
      {loading && items.length === 0 ? (
        <p className="text-xs text-slate-500">Cargando leads…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-600">Todavía no hay leads. Tocá «Agregar» para sumar una persona.</p>
      ) : (
        <ul className="divide-y divide-sky-100 overflow-hidden rounded-md border border-sky-100 bg-white/90">
          {items.map((d) => {
            const status = leadStatus(d, today);
            return (
              <li key={d.id} className="flex items-center gap-1 pr-1">
                <button
                  type="button"
                  onClick={() => openDetail(d)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left cursor-pointer"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-slate-900">{d.clientName}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {d.name}
                      {d.servicio ? ` · ${d.servicio}` : ""}
                      {d.origen ? ` · ${d.origen}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${status.className}`}>
                    {status.label}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => openForm(d)}
                  disabled={saving}
                  title="Editar"
                  aria-label={`Editar ${d.clientName}`}
                  className="rounded-md p-1.5 text-slate-400 hover:text-sky-700 cursor-pointer disabled:opacity-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(d)}
                  disabled={saving}
                  title="Quitar de leads"
                  aria-label={`Quitar a ${d.clientName}`}
                  className="rounded-md p-1.5 text-slate-400 hover:text-red-600 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
