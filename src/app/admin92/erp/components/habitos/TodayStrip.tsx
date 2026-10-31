"use client";

import type { ReactNode } from "react";
import { AlarmClock, Headphones, Play, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatClock, formatDuration, minutesBetween } from "@/app/admin92/erp/lib/erpHabitos";
import type { ErpMood } from "@/app/admin92/erp/lib/erpHabitos";
import type { AlarmRow } from "@/app/admin92/erp/components/habitos/AlarmSection";

function Chip({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#c5d4e8] bg-[#e4eef8] px-2.5 py-1 text-xs text-[#0f2744]">
      <Icon className="h-3.5 w-3.5 shrink-0 text-[#1d4e89]" aria-hidden />
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function delayLabel(alarm: AlarmRow | null): string | null {
  if (!alarm?.rangAt || !alarm.startedWorkAt) return null;
  const minutes = minutesBetween(alarm.rangAt, alarm.startedWorkAt);
  if (minutes === null) return null;
  return `${formatDuration(minutes)} después`;
}

export function TodayStrip({
  loading,
  alarm,
  openMood,
  nowLabel,
  cuatroHoras,
}: {
  loading: boolean;
  alarm: AlarmRow | null;
  openMood: ErpMood | null;
  nowLabel: string;
  cuatroHoras: boolean | null;
}) {
  if (loading) {
    return (
      <div className="mb-4 flex flex-wrap gap-2" aria-hidden>
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className="h-7 w-28 animate-pulse rounded-full bg-[#e4eef8]" />
        ))}
      </div>
    );
  }

  const elapsedMinutes = openMood ? minutesBetween(openMood.startedAt, nowLabel) : null;
  const elapsed = elapsedMinutes === null ? null : formatDuration(elapsedMinutes);
  const after = delayLabel(alarm);
  const cuatroLabel =
    cuatroHoras === true ? "Cumplí" : cuatroHoras === false ? "No cumplí" : "Pendiente";
  const cuatroClass =
    cuatroHoras === true ? "text-[#15803d]" : cuatroHoras === false ? "text-[#9f1239]" : "text-[#3d5270]";

  return (
    <div className="mb-4 flex flex-wrap gap-2">
      <Chip icon={AlarmClock}>Alarma {alarm?.rangAt ? formatClock(alarm.rangAt) : "—"}</Chip>
      <Chip icon={Play}>
        Comienzo {alarm?.startedWorkAt ? formatClock(alarm.startedWorkAt) : "—"}
        {after ? ` · ${after}` : ""}
      </Chip>
      <Chip icon={Headphones}>
        {openMood ? `${openMood.mood}${elapsed ? ` · ${elapsed}` : ""}` : "Sin mood activo"}
      </Chip>
      <Chip icon={Target}>
        4 hs: <span className={`font-semibold ${cuatroClass}`}>{cuatroLabel}</span>
      </Chip>
    </div>
  );
}
