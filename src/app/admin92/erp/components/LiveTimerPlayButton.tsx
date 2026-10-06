"use client";

import { Play, Square } from "lucide-react";
import {
  timerDestinoKey,
  type ErpActiveWorkTimer,
  type ErpTimerDestino,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";

export function isMatchingLiveTimer(
  active: ErpActiveWorkTimer | null | undefined,
  category: WorkCategoryKey,
  name: string,
  destino?: ErpTimerDestino,
): boolean {
  if (!active || active.category !== category) return false;
  if (active.name.trim().toLowerCase() !== name.trim().toLowerCase()) return false;
  return timerDestinoKey(active) === timerDestinoKey(destino);
}

type Props = {
  category: WorkCategoryKey;
  name?: string;
  destino?: ErpTimerDestino;
  activeWorkTimer?: ErpActiveWorkTimer | null;
  onToggle: (category: WorkCategoryKey, name: string, destino?: ErpTimerDestino) => Promise<void> | void;
  disabled?: boolean;
  /** Accesible label override */
  label?: string;
};

export default function LiveTimerPlayButton({
  category,
  name = "",
  destino,
  activeWorkTimer = null,
  onToggle,
  disabled = false,
  label,
}: Props) {
  const running = isMatchingLiveTimer(activeWorkTimer, category, name, destino);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={
        label ??
        (running
          ? "Detener timer"
          : name.trim()
            ? `Iniciar ${name}`
            : "Iniciar categoría")
      }
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        void onToggle(category, name, destino);
      }}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition cursor-pointer disabled:opacity-50 ${
        running
          ? "border-rose-300 bg-rose-50 text-rose-600 hover:bg-rose-100"
          : "border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
      }`}
    >
      {running ? (
        <Square className="h-3 w-3 fill-current" />
      ) : (
        <Play className="h-3.5 w-3.5 fill-current" />
      )}
    </button>
  );
}
