"use client";

import { useEffect, useState } from "react";
import { Check, ListChecks, Pencil, Trash2, X } from "lucide-react";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import {
  CUATRO_HORAS_NOTA_MAX,
  HABITO_MAX,
  MOOD_MAX,
  type CuatroHorasMark,
  type ErpHabito,
  type ErpMood,
} from "@/app/admin92/erp/lib/erpHabitos";

function formatDayMonth(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  return `${day}/${month}`;
}

function nowClock(): string {
  const now = new Date();
  return `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function MoodEntry({
  entry,
  onRemove,
  removing,
}: {
  entry: ErpMood;
  onRemove?: () => void;
  removing?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[#c5d4e8] border-l-4 border-l-[#1d4e89] bg-white px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-[#1d4e89] px-1.5 py-0.5 text-[11px] font-bold text-white">
              {entry.startedAt}
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1d4e89]">
              Arranco
            </span>
            <span className="rounded-lg bg-[#e4eef8] px-2 py-1 text-xs font-medium text-[#0f2744]">
              {entry.mood}
            </span>
          </div>
          {entry.endedAt ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-[#3d5270] px-1.5 py-0.5 text-[11px] font-bold text-white">
                {entry.endedAt}
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#3d5270]">
                Pausa
              </span>
            </div>
          ) : null}
        </div>
        {onRemove ? (
          <button
            type="button"
            aria-label={`Quitar ${entry.mood}`}
            disabled={removing}
            onClick={onRemove}
            className="shrink-0 rounded-lg p-1.5 text-[#3d5270] hover:bg-[#e4eef8] hover:text-[#0f2744] cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function DayMarks({
  fulfilled,
  note,
  disabled,
  label,
  showNote = true,
  onSet,
  onNote,
}: {
  fulfilled: boolean | null;
  note: string;
  disabled?: boolean;
  label: string;
  showNote?: boolean;
  onSet: (fulfilled: boolean | null) => void;
  onNote: (note: string) => void;
}) {
  const yes = fulfilled === true;
  const no = fulfilled === false;
  const [draft, setDraft] = useState(note);

  useEffect(() => {
    setDraft(note);
  }, [note]);

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-[#0f2744]">
        <button
          type="button"
          aria-pressed={yes}
          aria-label={`${label}: cumplí`}
          disabled={disabled}
          onClick={() => onSet(yes ? null : true)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border cursor-pointer disabled:opacity-50 ${
            yes
              ? "border-[#1d4e89] bg-[#1d4e89] text-white"
              : "border-[#1d4e89] bg-white text-[#1d4e89]"
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
        <button
          type="button"
          aria-pressed={no}
          aria-label={`${label}: no cumplí`}
          disabled={disabled}
          onClick={() => onSet(no ? null : false)}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border cursor-pointer disabled:opacity-50 ${
            no
              ? "border-[#9f1239] bg-[#9f1239] text-white"
              : "border-[#9f1239] bg-white text-[#9f1239]"
          }`}
        >
          <X className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
        <span>{label}</span>
      </div>
      {showNote ? (
        <input
          type="text"
          value={draft}
          disabled={disabled}
          maxLength={CUATRO_HORAS_NOTA_MAX}
          placeholder="Nota opcional"
          aria-label={`${label}: nota`}
          onChange={(event) => setDraft(event.target.value.slice(0, CUATRO_HORAS_NOTA_MAX))}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim().slice(0, CUATRO_HORAS_NOTA_MAX);
            if (next !== note.trim()) onNote(next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="mt-1.5 w-full rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs text-[#0f2744] placeholder:text-[#3d5270] disabled:opacity-50"
        />
      ) : null}
    </div>
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
  const [moods, setMoods] = useState<ErpMood[]>([]);
  const [moodDraft, setMoodDraft] = useState("");
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
      const moodsResponse = await fetch("/api/admin/erp-moods", { cache: "no-store" });
      const moodsData = (await moodsResponse.json()) as { moods?: ErpMood[]; error?: string };
      if (!moodsResponse.ok) throw new Error(moodsData.error || "No se pudieron cargar los moods.");
      setMoods(moodsData.moods ?? []);
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

  const persistDay = async (date: string, fulfilled: boolean | null, note: string) => {
    if (!date) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/erp-habitos/cuatro-horas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, fulfilled, note }),
      });
      const data = (await response.json()) as { mark?: CuatroHorasMark; error?: string };
      if (!response.ok || !data.mark) {
        throw new Error(data.error || "No se pudo guardar el día.");
      }
      const saved = data.mark;
      setMarks((prev) => {
        const next = prev.filter((row) => row.date !== saved.date);
        if (saved.fulfilled !== null || saved.note.trim()) next.push(saved);
        next.sort((a, b) => (a.date < b.date ? 1 : -1));
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el día.");
    } finally {
      setSaving(false);
    }
  };

  const markFor = (date: string): boolean | null => {
    const row = marks.find((item) => item.date === date);
    return row ? row.fulfilled : null;
  };
  const noteFor = (date: string) => marks.find((item) => item.date === date)?.note ?? "";
  const history = marks.filter((row) => row.date !== today);
  const todayMoods = moods.filter((row) => row.date === today);
  const openMood = todayMoods.find((row) => row.endedAt === null) ?? null;
  const pastMoodDates = Array.from(
    new Set(moods.filter((row) => row.date !== today).map((row) => row.date)),
  );

  const startMood = async () => {
    const mood = moodDraft.trim();
    if (!mood || openMood) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/erp-moods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today, mood, startedAt: nowClock() }),
      });
      const data = (await response.json()) as { mood?: ErpMood; error?: string };
      if (!response.ok || !data.mood) throw new Error(data.error || "No se pudo arrancar el mood.");
      const saved = data.mood;
      setMoods((prev) => [...prev.filter((row) => row._id !== saved._id), saved]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo arrancar el mood.");
    } finally {
      setSaving(false);
    }
  };

  const pauseMood = async () => {
    if (!openMood) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/erp-moods", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: openMood._id, endedAt: nowClock() }),
      });
      const data = (await response.json()) as { mood?: ErpMood; error?: string };
      if (!response.ok || !data.mood) throw new Error(data.error || "No se pudo pausar el mood.");
      const saved = data.mood;
      setMoods((prev) => prev.map((row) => (row._id === saved._id ? saved : row)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo pausar el mood.");
    } finally {
      setSaving(false);
    }
  };

  const removeMood = async (id: string) => {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/erp-moods?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudo quitar el mood.");
      setMoods((prev) => prev.filter((row) => row._id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo quitar el mood.");
    } finally {
      setSaving(false);
    }
  };

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
            className="flex max-h-[min(40rem,90vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[#c5d4e8] bg-white p-6"
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

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 md:grid-cols-2">
            <section className="min-h-0 overflow-y-auto rounded-xl border border-[#c5d4e8] bg-white p-3">
              <h3 className="text-sm font-semibold text-[#0f2744]">Mood</h3>
              <label className="mt-2 block text-xs font-medium text-[#3d5270]">
                Mood
                <input
                  type="text"
                  value={moodDraft}
                  maxLength={MOOD_MAX}
                  placeholder="pomodoro with paul"
                  onChange={(event) => setMoodDraft(event.target.value.slice(0, MOOD_MAX))}
                  className="mt-1 w-full rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm font-normal text-[#0f2744] placeholder:text-[#3d5270]"
                />
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !moodDraft.trim() || Boolean(openMood)}
                  onClick={() => void startMood()}
                  className="rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#163d6b] cursor-pointer disabled:opacity-50"
                >
                  Arrancar
                </button>
                <button
                  type="button"
                  disabled={saving || !openMood}
                  onClick={() => void pauseMood()}
                  className="rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0f2744] hover:bg-[#e4eef8] cursor-pointer disabled:opacity-50"
                >
                  Pausa
                </button>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-[#0f2744]">Hoy · {formatDayMonth(today)}</p>
                {todayMoods.length === 0 ? (
                  <p className="text-xs text-[#3d5270]">Todavía no hay moods hoy.</p>
                ) : (
                  todayMoods.map((entry) => (
                    <MoodEntry
                      key={entry._id}
                      entry={entry}
                      removing={saving}
                      onRemove={() => void removeMood(entry._id)}
                    />
                  ))
                )}
              </div>
              {pastMoodDates.length > 0 ? (
                <div className="mt-4 space-y-3">
                  <p className="text-xs font-semibold text-[#0f2744]">Días anteriores</p>
                  {pastMoodDates.map((date) => (
                    <div key={date}>
                      <p className="text-xs font-semibold text-[#3d5270]">{formatDayMonth(date)}</p>
                      {moods
                        .filter((entry) => entry.date === date)
                        .map((entry) => <MoodEntry key={entry._id} entry={entry} />)}
                    </div>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              <section className="rounded-xl border border-[#c5d4e8] bg-white p-3">
                <h3 className="text-sm font-semibold text-[#0f2744]">4 hs antes del almuerzo</h3>
                <div className="mt-2">
                  <DayMarks
                    fulfilled={markFor(today)}
                    note={noteFor(today)}
                    disabled={saving}
                    label={`Hoy · ${formatDayMonth(today)}`}
                    onSet={(fulfilled) => {
                      void persistDay(today, fulfilled, noteFor(today));
                    }}
                    onNote={(note) => {
                      void persistDay(today, markFor(today), note);
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
                  <DayMarks
                    fulfilled={otherDate ? markFor(otherDate) : null}
                    note={otherDate ? noteFor(otherDate) : ""}
                    disabled={saving || !otherDate}
                    showNote={Boolean(otherDate)}
                    label="Este día"
                    onSet={(fulfilled) => {
                      void persistDay(otherDate, fulfilled, noteFor(otherDate));
                    }}
                    onNote={(note) => {
                      void persistDay(otherDate, markFor(otherDate), note);
                    }}
                  />
                </div>
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-[#0f2744]">Historial</p>
                  {history.length === 0 ? (
                    <p className="text-xs text-[#3d5270]">Todavía no hay días anteriores.</p>
                  ) : (
                    history.map((row) => (
                      <DayMarks
                        key={row.date}
                        fulfilled={row.fulfilled}
                        note={row.note}
                        disabled={saving}
                        label={formatDayMonth(row.date)}
                        onSet={(fulfilled) => {
                          void persistDay(row.date, fulfilled, row.note);
                        }}
                        onNote={(note) => {
                          void persistDay(row.date, row.fulfilled, note);
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
            </div>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
