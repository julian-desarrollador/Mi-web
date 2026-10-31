"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const PHRASE =
  "No podemos evitar ser influenciados, pero sí podemos elegir las fuentes de esa influencia";

export default function ErpReflection() {
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
      <div className="mb-8 flex justify-center">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="max-w-2xl cursor-pointer text-center text-sm italic leading-relaxed text-slate-500 transition"
        >
          “{PHRASE}”
        </button>
      </div>

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
            aria-labelledby="erp-reflection-title"
            className="max-h-[min(36rem,90vh)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2
                id="erp-reflection-title"
                className="text-lg font-semibold leading-snug text-slate-950 sm:text-xl"
              >
                {PHRASE}
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 text-sm leading-relaxed text-slate-700">
              <p>
                Un concepto clave de la psicología y la neurociencia moderna: el{" "}
                <strong className="font-semibold text-slate-900">diseño de entorno consciente</strong>.{" "}
                {PHRASE}.
              </p>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">
                  Por qué el entorno nos moldea sin permiso
                </h3>
                <ul className="space-y-2">
                  <li>
                    <strong className="font-semibold text-slate-900">Neuronas espejo:</strong> tu
                    cerebro imita inconscientemente las acciones, gestos y estados de ánimo de los
                    seres vivos que te rodean.
                  </li>
                  <li>
                    <strong className="font-semibold text-slate-900">Contagio social:</strong> los
                    hábitos, la actitud ante los problemas y hasta los niveles de estrés de tus
                    personas cercanas se transfieren a ti.
                  </li>
                  <li>
                    <strong className="font-semibold text-slate-900">Estímulos físicos:</strong> la
                    luz, el orden de tu habitación y los ruidos de tu ciudad alteran tus niveles de
                    cortisol y dopamina de forma automática.
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-900">
                  Cómo aplicar esa inteligencia para decidir qué te influye
                </h3>
                <ul className="space-y-2">
                  <li>
                    <strong className="font-semibold text-slate-900">Curación de contenido:</strong>{" "}
                    trata lo que lees, miras y escuchas en internet con la misma exigencia que la
                    comida que ingieres.
                  </li>
                  <li>
                    <strong className="font-semibold text-slate-900">Filtrado relacional:</strong>{" "}
                    establece límites claros con personas que drenan tu energía y busca
                    activamente círculos que te inspiren.
                  </li>
                  <li>
                    <strong className="font-semibold text-slate-900">Arquitectura de espacios:</strong>{" "}
                    diseña tu casa u oficina para que los buenos hábitos sean fáciles de ejecutar y
                    las distracciones sean difíciles de alcanzar.
                  </li>
                </ul>
              </div>

              <p>
                Al final, la verdadera autonomía no es ser inmune al mundo, sino construir un mundo
                a tu alrededor que te impulse hacia donde realmente quieres ir.
              </p>
            </div>
          </article>
        </div>
      ) : null}
    </>
  );
}
