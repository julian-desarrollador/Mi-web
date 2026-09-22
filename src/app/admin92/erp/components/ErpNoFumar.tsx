"use client";

import { useEffect, useState } from "react";
import { Ban, X } from "lucide-react";

export default function ErpNoFumar() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 cursor-pointer"
      >
        <Ban className="h-4 w-4" />
        No fumar
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="erp-no-fumar-title"
            className="max-h-[min(36rem,90vh)] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 id="erp-no-fumar-title" className="text-lg font-semibold text-slate-950">
                No fumar
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-slate-700">
              <p className="font-semibold text-slate-900">
                El mayor riesgo que atenta contra mi sueño.
              </p>
              <p>
                <strong className="font-semibold text-slate-900">
                  El consumo regular de marihuana ralentiza las reacciones físicas y mentales
                </strong>
                , afecta la concentración y daña la memoria a corto plazo, lo que disminuye la
                capacidad de aprendizaje (especialmente en menores de 25 años). Además, altera la
                dopamina en el cerebro, lo que provoca{" "}
                <strong className="font-semibold text-slate-900">
                  cambios bruscos de humor, ansiedad y el llamado &quot;síndrome amotivacional&quot;
                </strong>
                , una apatía generalizada que quita el interés por el estudio, el trabajo y las
                metas personales.
              </p>
              <p>
                Recordemos que la voluntad es eficaz sobre las conductas, no sobre la química. Y
                es a nivel químico que hay que entender que las cosas se han cambiado de manera
                irreversible si el consumo ha afectado zonas específicas del cerebro. Es decir,
                que lo que hace difícil{" "}
                <a
                  href="https://www.centrobonanova.com/tratamientos/cannabis/"
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Dejar cannabis"
                  className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                >
                  dejar el cannabis
                </a>{" "}
                se produce por modificaciones a nivel químico.
              </p>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
