"use client";

import { Briefcase } from "lucide-react";

export default function ChambaToggle({
  pressed,
  onClick,
  disabled,
  icon = false,
}: {
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon?: boolean;
}) {
  const label = pressed ? "Quitar chamba" : "Marcar como chamba";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
        icon ? "p-2" : "px-2.5 py-1 text-xs font-semibold"
      } ${
        pressed
          ? "border-[#9a3412] bg-[#c2410c] text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {icon ? <Briefcase className="h-4 w-4" /> : "Chamba"}
    </button>
  );
}
