"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  formatLocalDate,
  formatMonthLabel,
  getMonthKeySafe,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"] as const;
const YMD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 340;

function ymdFromParts(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function popoverPosition(
  anchor: DOMRect,
  placement: "anchor" | "center",
): { top: number; left: number } {
  if (placement === "center") {
    const left = Math.max(8, (window.innerWidth - POPOVER_WIDTH) / 2);
    const top = Math.max(8, (window.innerHeight - POPOVER_HEIGHT) / 2);
    return {
      top: Math.min(top, Math.max(8, window.innerHeight - POPOVER_HEIGHT - 8)),
      left: Math.min(left, Math.max(8, window.innerWidth - POPOVER_WIDTH - 8)),
    };
  }
  let left = anchor.left;
  if (left + POPOVER_WIDTH > window.innerWidth - 8) {
    left = Math.max(8, window.innerWidth - POPOVER_WIDTH - 8);
  }
  let top = anchor.bottom + 6;
  if (top + POPOVER_HEIGHT > window.innerHeight - 8 && anchor.top > POPOVER_HEIGHT) {
    top = anchor.top - POPOVER_HEIGHT - 6;
  }
  return { top, left };
}

function getMonthGrid(ym: string): { date: string; inMonth: boolean }[] {
  const [y, m] = ym.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  let startPad = first.getDay() - 1;
  if (startPad < 0) startPad = 6;

  const cells: { date: string; inMonth: boolean }[] = [];

  for (let i = startPad - 1; i >= 0; i--) {
    const d = new Date(y, m - 1, -i);
    cells.push({
      date: ymdFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: ymdFromParts(y, m, day), inMonth: true });
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1];
    const [ly, lm, ld] = last.date.split("-").map(Number);
    const d = new Date(ly, lm - 1, ld + 1);
    cells.push({
      date: ymdFromParts(d.getFullYear(), d.getMonth() + 1, d.getDate()),
      inMonth: false,
    });
  }

  return cells;
}

type Props = {
  value: string;
  onChange: (ymd: string) => void;
  onFocus?: () => void;
  onBlur?: (ymd: string) => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  "aria-label"?: string;
  allowClear?: boolean;
  placeholder?: string;
  placement?: "anchor" | "center";
};

export default function DatePickerField({
  value,
  onChange,
  onFocus,
  onBlur,
  disabled = false,
  className = "",
  title,
  "aria-label": ariaLabel,
  allowClear = false,
  placeholder = "Elegir fecha",
  placement = "anchor",
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const validValue = YMD_PATTERN.test(value) ? value : "";
  const [viewMonth, setViewMonth] = useState(() =>
    getMonthKeySafe(validValue || todayYmd()),
  );

  const today = todayYmd();
  const grid = useMemo(() => getMonthGrid(viewMonth), [viewMonth]);
  const stretch = /\bw-full\b/.test(className);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    setViewMonth(getMonthKeySafe(validValue || todayYmd()));
  }, [open, validValue]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const updatePos = () => {
      const el = rootRef.current;
      if (!el) return;
      setPos(popoverPosition(el.getBoundingClientRect(), placement));
    };
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [open, placement]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      onBlur?.(validValue);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        onBlur?.(validValue);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onBlur, validValue]);

  const selectDay = (ymd: string) => {
    onChange(ymd);
    setOpen(false);
    onBlur?.(ymd);
  };

  const clearDate = () => {
    onChange("");
    setOpen(false);
    onBlur?.("");
  };

  const label = validValue ? formatLocalDate(validValue) : placeholder;

  const popover = open && mounted && pos ? (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Elegir fecha"
      style={{ top: pos.top, left: pos.left, width: POPOVER_WIDTH }}
      className="fixed z-[80] rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_20px_50px_rgba(15,23,42,0.16)]"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
          aria-label="Mes anterior"
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-slate-900">
          {formatMonthLabel(viewMonth)}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
          aria-label="Mes siguiente"
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 cursor-pointer"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-1 text-center text-[10px] font-medium text-slate-500"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell) => {
          const isSelected = validValue !== "" && cell.date === validValue;
          const isToday = cell.date === today;
          return (
            <button
              key={cell.date}
              type="button"
              onClick={() => selectDay(cell.date)}
              className={`flex h-8 cursor-pointer items-center justify-center rounded-lg border text-sm transition-colors ${
                isSelected
                  ? "border-[#84b9ed] bg-[#e8f3fc] font-semibold text-slate-900"
                  : isToday
                    ? "border-[#84b9ed] bg-slate-50 font-medium text-slate-900"
                    : cell.inMonth
                      ? "border-transparent bg-white text-slate-900 hover:bg-slate-50"
                      : "border-transparent bg-white text-slate-400 hover:bg-slate-50"
              }`}
            >
              {Number(cell.date.slice(8, 10))}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
        <button
          type="button"
          onClick={() => selectDay(today)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-[#4a7fb8] hover:bg-slate-50 cursor-pointer"
        >
          Hoy
        </button>
        {allowClear && validValue ? (
          <button
            type="button"
            onClick={clearDate}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-50 cursor-pointer"
          >
            <X className="h-3 w-3" />
            Limpiar
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  ) : null;

  return (
    <span className={`relative ${stretch ? "block w-full" : "inline-block"}`} ref={rootRef}>
      <button
        type="button"
        disabled={disabled}
        title={title}
        aria-label={ariaLabel ?? title ?? "Elegir fecha"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (disabled) return;
          if (open) {
            setOpen(false);
            onBlur?.(validValue);
            return;
          }
          onFocus?.();
          const el = rootRef.current;
          if (el) setPos(popoverPosition(el.getBoundingClientRect(), placement));
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 text-left text-slate-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${stretch ? "w-full" : ""} ${className}`}
      >
        <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        <span className={validValue ? "text-inherit" : "text-slate-400"}>{label}</span>
      </button>
      {popover && createPortal(popover, document.body)}
    </span>
  );
}
