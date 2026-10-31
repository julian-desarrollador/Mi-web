"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const sectionCardClass = "rounded-xl border border-[#c5d4e8] bg-white p-3";

export function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-[#1d4e89]" aria-hidden />
        <h3 className="text-sm font-semibold text-[#0f2744]">{title}</h3>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="mt-3 space-y-2" aria-hidden>
      <div className="h-3 w-2/3 animate-pulse rounded bg-[#e4eef8]" />
      <div className="h-3 w-full animate-pulse rounded bg-[#e4eef8]" />
      <div className="h-3 w-4/5 animate-pulse rounded bg-[#e4eef8]" />
    </div>
  );
}
