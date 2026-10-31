"use client";

import { Activity, Trash2 } from "lucide-react";
import {
  MOOD_MAX,
  formatClock,
  formatDayMonth,
  formatDuration,
  minutesBetween,
  type ErpMood,
} from "@/app/admin92/erp/lib/erpHabitos";
import { SectionHeader, SectionSkeleton, sectionCardClass } from "@/app/admin92/erp/components/habitos/SectionHeader";

function MoodEntry({
  entry,
  onRemove,
  removing,
}: {
  entry: ErpMood;
  onRemove?: () => void;
  removing?: boolean;
}) {
  const span = entry.endedAt ? minutesBetween(entry.startedAt, entry.endedAt) : null;
  const range = entry.endedAt
    ? `${formatClock(entry.startedAt)} → ${formatClock(entry.endedAt)}${span === null ? "" : ` · ${formatDuration(span)}`}`
    : formatClock(entry.startedAt);

  return (
    <div className="rounded-xl border border-[#c5d4e8] border-l-4 border-l-[#1d4e89] bg-white px-3 py-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#0f2744]">{entry.mood}</p>
          <p className="mt-0.5 text-xs text-[#3d5270]">{range}</p>
        </div>
        {onRemove ? (
          <button
            type="button"
            aria-label={`Quitar ${entry.mood}`}
            disabled={removing}
            onClick={onRemove}
            className="shrink-0 rounded-lg p-1.5 text-[#3d5270] cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function dayDuration(entries: ErpMood[]): number {
  return entries.reduce((total, entry) => {
    if (!entry.endedAt) return total;
    const span = minutesBetween(entry.startedAt, entry.endedAt);
    return span === null ? total : total + span;
  }, 0);
}

export function MoodSection({
  today,
  moods,
  openMood,
  draft,
  saving,
  loading,
  hasError,
  nowLabel,
  onDraft,
  onStart,
  onPause,
  onRemove,
}: {
  today: string;
  moods: ErpMood[];
  openMood: ErpMood | null;
  draft: string;
  saving: boolean;
  loading: boolean;
  hasError: boolean;
  nowLabel: string;
  onDraft: (value: string) => void;
  onStart: () => void;
  onPause: () => void;
  onRemove: (id: string) => void;
}) {
  const todayMoods = moods
    .filter((row) => row.date === today)
    .sort((a, b) => (minutesBetween("0:00", a.startedAt) ?? 0) - (minutesBetween("0:00", b.startedAt) ?? 0));
  const finishedToday = todayMoods.filter((row) => row._id !== openMood?._id);
  const pastDates = Array.from(new Set(moods.filter((row) => row.date !== today).map((row) => row.date))).sort(
    (a, b) => (a < b ? 1 : -1),
  );
  const elapsed = openMood ? minutesBetween(openMood.startedAt, nowLabel) : null;

  return (
    <section className={`${sectionCardClass} min-h-0 flex-1 overflow-y-auto`} aria-busy={loading}>
      <SectionHeader icon={Activity} title="Mood" />
      {loading ? <SectionSkeleton /> : null}
      {!loading && openMood ? (
        <div className="mt-3 rounded-xl border-2 border-[#1d4e89] bg-[#e4eef8] px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#0f2744]">{openMood.mood}</p>
              <p className="mt-0.5 text-xs text-[#3d5270]">
                desde {formatClock(openMood.startedAt)}
                {elapsed === null ? "" : ` · ${formatDuration(elapsed)}`}
              </p>
            </div>
            <button
              type="button"
              aria-label={`Quitar ${openMood.mood}`}
              disabled={saving}
              onClick={() => onRemove(openMood._id)}
              className="shrink-0 rounded-lg p-1.5 text-[#3d5270] cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onPause}
            className="mt-3 w-full rounded-lg bg-[#1d4e89] px-3 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            Pausa
          </button>
        </div>
      ) : null}
      {!loading && !openMood ? (
        <div className="mt-3">
          <label className="block text-xs font-medium text-[#3d5270]">
            Mood
            <input
              type="text"
              value={draft}
              maxLength={MOOD_MAX}
              placeholder="pomodoro with paul"
              onChange={(event) => onDraft(event.target.value.slice(0, MOOD_MAX))}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onStart();
              }}
              className="mt-1 w-full rounded-lg border border-[#c5d4e8] bg-white px-2.5 py-1.5 text-sm font-normal text-[#0f2744] placeholder:text-[#3d5270]"
            />
          </label>
          <button
            type="button"
            disabled={saving || !draft.trim()}
            onClick={onStart}
            className="mt-2 rounded-lg bg-[#1d4e89] px-2.5 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
          >
            Arrancar
          </button>
        </div>
      ) : null}
      {!loading && finishedToday.length > 0 ? (
        <div className="mt-3 space-y-2">
          {finishedToday.map((entry) => (
            <MoodEntry
              key={entry._id}
              entry={entry}
              removing={saving}
              onRemove={() => onRemove(entry._id)}
            />
          ))}
        </div>
      ) : null}
      {!loading && todayMoods.length === 0 && !hasError ? (
        <p className="mt-3 text-xs text-[#3d5270]">Todavía no hay moods hoy.</p>
      ) : null}
      {!loading && pastDates.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold text-[#0f2744]">Días anteriores</p>
          {pastDates.map((date) => {
            const entries = moods
              .filter((entry) => entry.date === date)
              .sort(
                (a, b) => (minutesBetween("0:00", a.startedAt) ?? 0) - (minutesBetween("0:00", b.startedAt) ?? 0),
              );
            const total = dayDuration(entries);
            const countLabel = entries.length === 1 ? "1 mood" : `${entries.length} moods`;
            return (
              <details key={date} className="rounded-lg border border-[#c5d4e8] px-2.5 py-1.5">
                <summary className="cursor-pointer text-xs font-semibold text-[#3d5270]">
                  {formatDayMonth(date)} · {countLabel} · {formatDuration(total)}
                </summary>
                <div className="mt-2 space-y-2">
                  {entries.map((entry) => (
                    <MoodEntry key={entry._id} entry={entry} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
