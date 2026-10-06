"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function StackModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="stack-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id="stack-modal-title" className="text-base font-semibold text-slate-900">
            Stack
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="cursor-pointer rounded-lg border border-slate-300 bg-white p-1.5 text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-sm font-semibold text-slate-900">Servicios externos</p>
          <p className="mt-2 text-sm text-slate-900">Todavía no hay nada cargado.</p>
        </div>
      </div>
    </div>
  );
}
