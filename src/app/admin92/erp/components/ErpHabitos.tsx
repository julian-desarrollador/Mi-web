"use client";

import { useEffect, useState } from "react";
import { Check, ListChecks, Pencil, Trash2, X } from "lucide-react";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import { HABITO_MAX, type CuatroHorasMark, type ErpHabito } from "@/app/admin92/erp/lib/erpHabitos";

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function DayCheck({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#0f2744]">
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onToggle(!checked)}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[#1d4e89] cursor-pointer disabled:opacity-50 ${
          checked ? "bg-[#1d4e89] text-white" : "bg-white text-[#1d4e89]"
        }`}
      >
        {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
      </button>
      {label}
    </label>
  );
}

export default function ErpHabitos() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ErpHabito[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [marks, setMarks] = useState<CuatroHorasMark[]>([]);
  const [otherDate, setOtherDate] = useState("");
  const today = todayYmd();

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
    void loadItems();
  }, [open]);

  const loadItems = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/erp-habitos", { cache: "no-store" });
      const data = (await response.json()) as { habitos?: ErpHabito[]; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron cargar los hábitos.");
      setItems(data.habitos ?? []);
      const marksResponse = await fetch("/api/admin/erp-habitos/cuatro-horas", { cache: "no-store" });
      const marksData = (await marksResponse.json()) as { marks?: CuatroHorasMark[]; error?: string };
      if (!marksResponse.ok) throw new Error(marksData.error || "No se pudo cargar el historial.");
      setMarks(marksData.marks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los hábitos.");
    } finally {
      setLoading(false);
    }
  };

  const createHabito = async () => {
    const text = draft.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/erp-habitos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as { habito?: ErpHabito; error?: string };
      if (!response.ok || !data.habito) {
        throw new Error(data.error || "No se pudo crear el hábito.");
      }
      setItems((prev) => [...prev, data.habito as ErpHabito]);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el hábito.");
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const text = editDraft.trim();
    if (!text) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/erp-habitos/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = (await response.json()) as { habito?: ErpHabito; error?: string };
      if (!response.ok || !data.habito) {
        throw new Error(data.error || "No se pudo actualizar el hábito.");
      }
      const saved = data.habito;
      setItems((prev) => prev.map((row) => (row._id === saved._id ? saved : row)));
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el hábito.");
    } finally {
      setSaving(false);
    }
  };

  const toggleMark = async (date: string, checked: boolean) => {
    if (!date) return;
    setSaving(true);
    setError("");
    try {
      if (!checked) {
        const response = await fetch(
          `/api/admin/erp-habitos/cuatro-horas?date=${encodeURIComponent(date)}`,
          { method: "DELETE" },
        );
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || "No se pudo desmarcar el día.");
        setMarks((prev) => prev.filter((row) => row.date !== date));
        return;
      }
      const response = await fetch("/api/admin/erp-habitos/cuatro-horas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, fulfilled: true }),
      });
      const data = (await response.json()) as { mark?: CuatroHorasMark; error?: string };
      if (!response.ok || !data.mark) {
        throw new Error(data.error || "No se pudo guardar el día.");
      }
      const saved = data.mark;
      setMarks((prev) => {
        const next = prev.filter((row) => row.date !== saved.date);
        next.push(saved);
        next.sort((a, b) => (a.date < b.date ? 1 : -1));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el día.");
    } finally {
      setSaving(false);
    }
  };

  const isChecked = (date: string) => marks.some((row) => row.date === date && row.fulfilled);
  const history = marks.filter((row) => row.date !== today && row.fulfilled);

  const removeHabito = async (item: ErpHabito) => {
    if (!window.confirm("¿Eliminar este hábito?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/erp-habitos/${item._id}`, { method: "DELETE" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo eliminar el hábito.");
      setItems((prev) => prev.filter((row) => row._id !== item._id));
      if (editingId === item._id) {
        setEditingId(null);
        setEditDraft("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el hábito.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
      >
        <ListChecks className="h-4 w-4" />
        Hábitos
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/45 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="erp-habitos-title"
            className="flex max-h-[min(36rem,90vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[#c5d4e8] bg-white p-6"
          >
            <div className="mb-1 flex items-start justify-between gap-3">
              <h2 id="erp-habitos-title" className="text-lg font-semibold text-[#0f2744]">
                Hábitos
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg p-1.5 text-[#3d5270] transition hover:bg-[#e4eef8] hover:text-[#0f2744] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-4 text-sm font-medium text-[#0f2744]">Para lograr el sueño.</p>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <section className="rounded-xl border border-[#c5d4e8] bg-white p-3">
                <h3 className="text-sm font-semibold text-[#0f2744]">4 hs antes del almuerzo</h3>
                <div className="mt-2">
                  <DayCheck
                    checked={isChecked(today)}
                    disabled={saving}
                    label={`Hoy · ${formatDayMonth(today)}`}
                    onToggle={(checked) => {
                      void toggleMark(today, checked);
                    }}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <DatePickerField
                    value={otherDate}
                    onChange={setOtherDate}
                    allowClear
                    placement="center"
                    aria-label="Elegir otro día"
                    className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs text-[#0f2744]"
                  />
                  <DayCheck
                    checked={Boolean(otherDate) && isChecked(otherDate)}
                    disabled={saving || !otherDate}
                    label="Este día"
                    onToggle={(checked) => {
                      void toggleMark(otherDate, checked);
                    }}
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-[#0f2744]">Historial</p>
                  {history.length === 0 ? (
                    <p className="text-xs text-[#3d5270]">Todavía no hay días anteriores.</p>
                  ) : (
                    history.map((row) => (
                      <DayCheck
                        key={row.date}
                        checked
                        disabled={saving}
                        label={formatDayMonth(row.date)}
                        onToggle={(checked) => {
                          void toggleMark(row.date, checked);
                        }}
                      />
                    ))
                  )}
                </div>
              </section>
              {loading ? <p className="text-sm text-[#3d5270]">Cargando…</p> : null}
              {!loading && items.length === 0 ? (
                <p className="text-sm text-[#3d5270]">Todavía no hay hábitos.</p>
              ) : null}
              {items.map((item) => (
                <div key={item._id} className="rounded-xl border border-[#c5d4e8] bg-white p-3">
                  {editingId === item._id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editDraft}
                        onChange={(event) => setEditDraft(event.target.value.slice(0, HABITO_MAX))}
                        rows={4}
                        maxLength={HABITO_MAX}
                        className="w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-2 text-sm text-[#0f2744]"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={saving || !editDraft.trim()}
                          onClick={() => void saveEdit()}
                          className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft("");
                          }}
                          className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs font-medium text-[#0f2744] hover:bg-[#e4eef8] cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-[#0f2744]">
                        {item.text}
                      </p>
                      <button
                        type="button"
                        aria-label="Editar hábito"
                        disabled={saving}
                        onClick={() => {
                          setEditingId(item._id);
                          setEditDraft(item.text);
                        }}
                        className="shrink-0 rounded-lg p-1.5 text-[#3d5270] hover:bg-[#e4eef8] hover:text-[#0f2744] cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Eliminar hábito"
                        disabled={saving}
                        onClick={() => void removeHabito(item)}
                        className="shrink-0 rounded-lg p-1.5 text-[#3d5270] hover:bg-[#e4eef8] hover:text-[#0f2744] cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

            <div className="mt-4 space-y-2 border-t border-[#c5d4e8] pt-4">
              <label className="block text-sm font-semibold text-[#0f2744]">
                Agregar hábito
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.slice(0, HABITO_MAX))}
                  rows={3}
                  maxLength={HABITO_MAX}
                  placeholder="Un hábito nuevo…"
                  className="mt-1.5 w-full resize-y rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-2 text-sm font-normal text-[#0f2744] placeholder:text-[#3d5270]"
                />
              </label>
              <button
                type="button"
                disabled={saving || !draft.trim()}
                onClick={() => void createHabito()}
                className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Agregar"}
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
