"use client";

import { useEffect, useState } from "react";
import { Check, Target, X } from "lucide-react";
import { shiftDate } from "@/app/admin92/contabilidad/lib/utils";
import {
  CUATRO_HORAS_NOTA_MAX,
  formatDayMonth,
  type CuatroHorasMark,
} from "@/app/admin92/erp/lib/erpHabitos";
import { SectionHeader, SectionSkeleton, sectionCardClass } from "@/app/admin92/erp/components/habitos/SectionHeader";

function DayMarks({
  fulfilled,
  note,
  disabled,
  label,
  onSet,
  onNote,
}: {
  fulfilled: boolean | null;
  note: string;
  disabled?: boolean;
  label: string;
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
    <div className="mt-3">
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
    </div>
  );
}

function statusWord(fulfilled: boolean | null): string {
  if (fulfilled === true) return "cumplí";
  if (fulfilled === false) return "no cumplí";
  return "sin dato";
}

function summarize(days: string[], marks: CuatroHorasMark[], today: string): string {
  const byDate = new Map(marks.map((mark) => [mark.date, mark.fulfilled]));
  let yes = 0;
  let decided = 0;
  for (const date of days) {
    const fulfilled = byDate.has(date) ? byDate.get(date) ?? null : null;
    if (fulfilled === true) yes += 1;
    if (fulfilled === true || fulfilled === false) decided += 1;
  }
  const pct = decided === 0 ? 0 : Math.round((yes / decided) * 100);
  let streak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    const fulfilled = byDate.has(days[index]) ? byDate.get(days[index]) ?? null : null;
    if (fulfilled === true) {
      streak += 1;
      continue;
    }
    if (fulfilled === null && days[index] === today) continue;
    break;
  }
  return `${yes}/${decided} días · ${pct} % · racha actual ${streak}`;
}

export function CuatroHorasSection({
  today,
  marks,
  loading,
  saving,
  hasError,
  onPersist,
}: {
  today: string;
  marks: CuatroHorasMark[];
  loading: boolean;
  saving: boolean;
  hasError: boolean;
  onPersist: (date: string, fulfilled: boolean | null, note: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const days = Array.from({ length: 28 }, (_, index) => shiftDate(today, index - 27));
  const byDate = new Map(marks.map((mark) => [mark.date, mark]));
  const todayMark = byDate.get(today);
  const selectedMark = selected ? byDate.get(selected) : undefined;

  return (
    <section className={sectionCardClass} aria-busy={loading}>
      <SectionHeader icon={Target} title="4 hs antes del almuerzo" />
      {loading ? <SectionSkeleton /> : null}
      {!loading && (!hasError || marks.length > 0) ? (
        <>
          <DayMarks
            fulfilled={todayMark ? todayMark.fulfilled : null}
            note={todayMark?.note ?? ""}
            disabled={saving}
            label={`Hoy · ${formatDayMonth(today)}`}
            onSet={(fulfilled) => onPersist(today, fulfilled, todayMark?.note ?? "")}
            onNote={(note) => onPersist(today, todayMark ? todayMark.fulfilled : null, note)}
          />
          <p className="mt-3 text-xs font-medium text-[#0f2744]">{summarize(days, marks, today)}</p>
          <div className="mt-2 grid grid-cols-7 gap-1" role="group" aria-label="Últimos 28 días">
            {days.map((date) => {
              const mark = byDate.get(date);
              const fulfilled = mark ? mark.fulfilled : null;
              const note = mark?.note ?? "";
              const label = formatDayMonth(date);
              const color =
                fulfilled === true
                  ? "border-[#15803d] bg-[#15803d] text-white"
                  : fulfilled === false
                    ? "border-[#9f1239] bg-[#9f1239] text-white"
                    : "border-[#c5d4e8] bg-[#d9e2ec] text-[#3d5270]";
              const isToday = date === today;
              const isSelected = date === selected;
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${label}: ${statusWord(fulfilled)}`}
                  title={note ? `${label} · ${note}` : label}
                  onClick={() => setSelected((current) => (current === date ? null : date))}
                  className={`flex aspect-square items-center justify-center rounded-md border text-[10px] font-semibold cursor-pointer ${color} ${
                    isToday ? "ring-2 ring-inset ring-[#1d4e89]" : ""
                  } ${isSelected ? "outline outline-2 -outline-offset-2 outline-[#0f2744]" : ""}`}
                >
                  {String(Number(date.slice(8, 10)))}
                </button>
              );
            })}
          </div>
          {selected && selected !== today ? (
            <DayMarks
              key={selected}
              fulfilled={selectedMark ? selectedMark.fulfilled : null}
              note={selectedMark?.note ?? ""}
              disabled={saving}
              label={formatDayMonth(selected)}
              onSet={(fulfilled) => onPersist(selected, fulfilled, selectedMark?.note ?? "")}
              onNote={(note) => onPersist(selected, selectedMark ? selectedMark.fulfilled : null, note)}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
