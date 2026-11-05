"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";

export type CuotaSelectOption = { value: string; label: string };

const SIZE_CLASS = {
  md: "px-3 py-2 text-sm",
  sm: "px-3 py-1.5 text-sm",
  xs: "px-2 py-1 text-xs",
} as const;

/** Fondo y texto explícitos para que Dark Reader invierta los dos y el menú siga legible. */
const SURFACE = { backgroundColor: "#ffffff", color: "#0f172a" } as const;
const SURFACE_ACTIVE = { backgroundColor: "#e0f2fe", color: "#020617" } as const;

export default function CuotaSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className = "w-full",
  size = "md",
}: {
  value: string;
  options: CuotaSelectOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  className?: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(
    null,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((option) => option.value === value)?.label ?? (value || "—");

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const gap = 4;
      const spaceBelow = window.innerHeight - rect.bottom - gap;
      const spaceAbove = rect.top - gap;
      const openUp = spaceBelow < 200 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(120, Math.min(240, openUp ? spaceAbove : spaceBelow));
      const top = openUp ? Math.max(8, rect.top - gap - maxHeight) : rect.bottom + gap;
      setMenuStyle({
        top,
        left: rect.left,
        width: Math.max(rect.width, 160),
        maxHeight,
      });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menu =
    open && menuStyle
      ? createPortal(
          <ul
            ref={menuRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: menuStyle.top,
              left: menuStyle.left,
              width: menuStyle.width,
              maxHeight: menuStyle.maxHeight,
              zIndex: 90,
              ...SURFACE,
            }}
            className="overflow-auto rounded-lg border border-slate-300 bg-white py-1 shadow-lg"
          >
            {options.map((option) => {
              const active = option.value === value;
              return (
                <li key={option.value || "vacio"} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    style={active ? SURFACE_ACTIVE : SURFACE}
                    className={`block w-full px-3 py-2 text-left cursor-pointer ${SIZE_CLASS[size]} ${
                      active ? "bg-sky-100 text-slate-950" : "bg-white text-slate-900"
                    }`}
                  >
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((prev) => !prev)}
        style={SURFACE}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white text-left text-slate-900 cursor-pointer focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent ${SIZE_CLASS[size]}`}
      >
        <span className="truncate">{selected}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {menu}
    </div>
  );
}
