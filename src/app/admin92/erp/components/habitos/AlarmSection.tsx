"use client";

import { AlarmClock } from "lucide-react";
import { shiftDate } from "@/app/admin92/contabilidad/lib/utils";
import {
  formatClock,
  formatDayMonth,
  formatDuration,
  minutesBetween,
} from "@/app/admin92/erp/lib/erpHabitos";
import { SectionHeader, SectionSkeleton, sectionCardClass } from "@/app/admin92/erp/components/habitos/SectionHeader";

export type AlarmRow = {
  date: string;
  rangAt: string | null;
  startedWorkAt: string | null;
};

function averageClock(values: Array<string | null>): string | null {
  const minutes = values.flatMap((value) => {
    if (!value) return [];
    const total = minutesBetween("0:00", value);
    return total === null ? [] : [total];
  });
  if (minutes.length === 0) return null;
  const avg = Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length);
  const hour = Math.floor(avg / 60) % 24;
  const minute = avg % 60;
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

function TimeBadge({ time, tone }: { time: string | null; tone: "alarm" | "start" }) {
  if (!time) return <span className="text-[#3d5270]">—</span>;
  const bg = tone === "alarm" ? "bg-[#3d5270]" : "bg-[#1d4e89]";
  return (
    <span className={`rounded-md ${bg} px-1.5 py-0.5 text-[11px] font-bold text-white`}>
      {formatClock(time)}
    </span>
  );
}

export function AlarmSection({
  today,
  rows,
  loading,
  hasError,
}: {
  today: string;
  rows: AlarmRow[];
  loading: boolean;
  hasError: boolean;
}) {
  const weekFrom = shiftDate(today, -6);
  const recent = rows.filter((row) => row.date >= weekFrom && row.date <= today);
  const alarmAvg = averageClock(recent.map((row) => row.rangAt));
  const startAvg = averageClock(recent.map((row) => row.startedWorkAt));
  const averageLabel = [
    alarmAvg ? `alarma ${alarmAvg}` : "",
    startAvg ? `comienzo ${startAvg}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className={`${sectionCardClass} flex min-h-0 flex-1 flex-col`} aria-busy={loading}>
      <SectionHeader icon={AlarmClock} title="Alarma y comienzo" />
      {loading ? <SectionSkeleton /> : null}
      {!loading && averageLabel ? (
        <p className="mt-2 text-xs font-medium text-[#3d5270]">Prom. {averageLabel}</p>
      ) : null}
      {!loading && rows.length === 0 && !hasError ? (
        <p className="mt-2 text-xs text-[#3d5270]">Cargá la alarma en «Cargar día».</p>
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto">
          <table className="w-full table-fixed text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b border-[#c5d4e8] text-[11px] font-semibold uppercase tracking-wide text-[#3d5270]">
                <th scope="col" className="pb-1.5 pr-2 font-semibold">
                  Día
                </th>
                <th scope="col" className="pb-1.5 pr-2 font-semibold">
                  Alarma
                </th>
                <th scope="col" className="pb-1.5 pr-2 font-semibold">
                  Comienzo
                </th>
                <th scope="col" className="pb-1.5 font-semibold" title="Minutos entre alarma y comienzo">
                  Δ
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const delta =
                  row.rangAt && row.startedWorkAt ? minutesBetween(row.rangAt, row.startedWorkAt) : null;
                const isToday = row.date === today;
                return (
                  <tr key={row.date} className={isToday ? "bg-[#e4eef8]" : "border-t border-[#e4eef8]"}>
                    <td className="py-1.5 pr-2 font-medium text-[#0f2744]">
                      {isToday ? "Hoy" : formatDayMonth(row.date)}
                    </td>
                    <td className="py-1.5 pr-2">
                      <TimeBadge time={row.rangAt} tone="alarm" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <TimeBadge time={row.startedWorkAt} tone="start" />
                    </td>
                    <td className="py-1.5 text-[#3d5270]">
                      {delta === null ? "—" : formatDuration(delta)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
