"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ListChecks, X } from "lucide-react";
import { shiftDate, todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import { type CuatroHorasMark, type ErpHabito } from "@/app/admin92/erp/lib/erpHabitos";
import { clockNow, useErpMoods } from "@/app/admin92/erp/lib/useErpMoods";
import type { ErpDayLog } from "@/app/admin92/erp/lib/erpTypes";
import { AlarmSection, type AlarmRow } from "@/app/admin92/erp/components/habitos/AlarmSection";
import { CuatroHorasSection } from "@/app/admin92/erp/components/habitos/CuatroHorasSection";
import { HabitosList } from "@/app/admin92/erp/components/habitos/HabitosList";
import { MoodSection } from "@/app/admin92/erp/components/habitos/MoodSection";
import { TodayStrip } from "@/app/admin92/erp/components/habitos/TodayStrip";

type HabitosTab = "hoy" | "mood" | "habitos";

const TABS: { id: HabitosTab; label: string }[] = [
  { id: "hoy", label: "Hoy" },
  { id: "mood", label: "Mood" },
  { id: "habitos", label: "Hábitos" },
];

function formatTodayHeading(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.toLocaleDateString("es-AR", { weekday: "long" });
  const label = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${label} ${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`;
}

function paneClass(active: boolean): string {
  return `${active ? "flex" : "hidden md:flex"} min-h-0 flex-col`;
}

export default function ErpHabitos() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<HabitosTab>("hoy");
  const [items, setItems] = useState<ErpHabito[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [marks, setMarks] = useState<CuatroHorasMark[]>([]);
  const moodsApi = useErpMoods();
  const { moods, openMood } = moodsApi;
  const [moodDraft, setMoodDraft] = useState("");
  const [alarmRows, setAlarmRows] = useState<AlarmRow[]>([]);
  const [now, setNow] = useState(() => new Date());
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  const today = todayYmd();
  const nowLabel = clockNow(now);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [habitosRes, marksRes, logsRes] = await Promise.all([
        fetch("/api/admin/erp-habitos", { cache: "no-store" }),
        fetch("/api/admin/erp-habitos/cuatro-horas", { cache: "no-store" }),
        fetch(`/api/admin/erp-logs?from=${shiftDate(today, -59)}&to=${today}`, { cache: "no-store" }),
        moodsApi.reload(),
      ]);
      const [habitosData, marksData, logsData] = (await Promise.all([
        habitosRes.json(),
        marksRes.json(),
        logsRes.json(),
      ])) as [
        { habitos?: ErpHabito[]; error?: string },
        { marks?: CuatroHorasMark[]; error?: string },
        { logs?: ErpDayLog[]; error?: string },
      ];
      if (!habitosRes.ok) throw new Error(habitosData.error || "No se pudieron cargar los hábitos.");
      if (!marksRes.ok) throw new Error(marksData.error || "No se pudo cargar el historial.");
      if (!logsRes.ok) throw new Error(logsData.error || "No se pudieron cargar las alarmas.");
      setItems(habitosData.habitos ?? []);
      setMarks(marksData.marks ?? []);
      setAlarmRows(
        (logsData.logs ?? [])
          .map((log) => ({
            date: log.date,
            rangAt: log.alarm?.rangAt ?? null,
            startedWorkAt: log.alarm?.startedWorkAt ?? null,
          }))
          .filter((row) => row.rangAt !== null || row.startedWorkAt !== null)
          .sort((a, b) => (a.date < b.date ? 1 : -1)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los hábitos.");
    } finally {
      setLoading(false);
    }
  }, [today, moodsApi.reload]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (adding || editingId) {
        event.preventDefault();
        if (adding) {
          setAdding(false);
          setDraft("");
        }
        if (editingId) {
          setEditingId(null);
          setEditDraft("");
        }
        return;
      }
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, adding, editingId]);

  useEffect(() => {
    if (!open) {
      setAdding(false);
      setEditingId(null);
      setEditDraft("");
      setDraft("");
      if (wasOpenRef.current) openButtonRef.current?.focus();
      return;
    }
    wasOpenRef.current = true;
    closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void loadItems();
  }, [open, loadItems]);

  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  const todayAlarm = alarmRows.find((row) => row.date === today) ?? null;
  const todayMark = marks.find((row) => row.date === today);

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
      setAdding(false);
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

  const startMood = async () => {
    const mood = moodDraft.trim();
    if (!mood || openMood) return;
    setSaving(true);
    setError("");
    try {
      await moodsApi.start(mood);
      setMoodDraft("");
      setNow(new Date());
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
      await moodsApi.close(openMood);
      setNow(new Date());
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
      await moodsApi.remove(id);
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

  const cancelAdd = () => {
    setAdding(false);
    setDraft("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition cursor-pointer"
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
            className="flex max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[#c5d4e8] bg-white p-4 md:p-6"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 id="erp-habitos-title" className="text-lg font-semibold text-[#0f2744]">
                  Hábitos
                </h2>
                <p className="text-sm font-medium text-[#0f2744]">Para lograr el sueño.</p>
                <p className="text-xs text-[#3d5270]">{formatTodayHeading(today)}</p>
              </div>
              <div className="flex items-center gap-2">
                {saving ? <span className="text-xs font-medium text-[#3d5270]">Guardando…</span> : null}
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="shrink-0 rounded-lg p-1.5 text-[#3d5270] transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {error ? (
              <div
                role="alert"
                className="mb-3 flex items-start justify-between gap-2 rounded-lg border border-[#9f1239]/20 bg-[#9f1239]/5 px-3 py-2 text-sm text-[#9f1239]"
              >
                <p>{error}</p>
                <button
                  type="button"
                  aria-label="Cerrar aviso"
                  onClick={() => setError("")}
                  className="shrink-0 rounded-lg p-1 cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <TodayStrip
              loading={loading}
              alarm={todayAlarm}
              openMood={openMood}
              nowLabel={nowLabel}
              cuatroHoras={todayMark ? todayMark.fulfilled : null}
            />

            <div className="mb-3 flex gap-1 rounded-lg bg-[#e4eef8] p-1 md:hidden" role="tablist">
              {TABS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === item.id}
                  onClick={() => setTab(item.id)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold cursor-pointer ${
                    tab === item.id ? "bg-[#1d4e89] text-white" : "text-[#0f2744]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className={`${paneClass(tab === "hoy")} overflow-hidden`}>
                <AlarmSection today={today} rows={alarmRows} loading={loading} hasError={Boolean(error)} />
              </div>
              <div className={`${paneClass(tab === "mood")} overflow-hidden`}>
                <MoodSection
                  today={today}
                  moods={moods}
                  openMood={openMood}
                  draft={moodDraft}
                  saving={saving}
                  loading={loading}
                  hasError={Boolean(error)}
                  nowLabel={nowLabel}
                  onDraft={setMoodDraft}
                  onStart={() => void startMood()}
                  onPause={() => void pauseMood()}
                  onRemove={(id) => void removeMood(id)}
                />
              </div>
              <div className={`${paneClass(tab === "habitos")} gap-3 overflow-y-auto`}>
                <CuatroHorasSection
                  today={today}
                  marks={marks}
                  loading={loading}
                  saving={saving}
                  hasError={Boolean(error)}
                  onPersist={(date, fulfilled, note) => {
                    void persistDay(date, fulfilled, note);
                  }}
                />
                <HabitosList
                  items={items}
                  loading={loading}
                  saving={saving}
                  hasError={Boolean(error)}
                  adding={adding}
                  draft={draft}
                  editingId={editingId}
                  editDraft={editDraft}
                  onStartAdd={() => setAdding(true)}
                  onCancelAdd={cancelAdd}
                  onDraft={setDraft}
                  onCreate={() => void createHabito()}
                  onStartEdit={(item) => {
                    setEditingId(item._id);
                    setEditDraft(item.text);
                  }}
                  onCancelEdit={cancelEdit}
                  onEditDraft={setEditDraft}
                  onSaveEdit={() => void saveEdit()}
                  onRemove={(item) => void removeHabito(item)}
                />
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
