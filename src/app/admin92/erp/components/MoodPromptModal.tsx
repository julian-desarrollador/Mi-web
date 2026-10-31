"use client";

import { useEffect, useRef, useState } from "react";
import { Headphones, LoaderCircle, X } from "lucide-react";
import { MOOD_MAX, MOOD_NOTE_MAX, type MoodScore } from "@/app/admin92/erp/lib/erpHabitos";

const SCORES: MoodScore[] = [1, 2, 3, 4, 5];

const SCORE_HINT: Record<MoodScore, string> = {
  1: "Muy disperso",
  2: "Bastante ruido",
  3: "Normal",
  4: "Enfocado",
  5: "Paz total",
};

export type MoodPromptProps =
  | {
      mode: "start";
      /** Mood abierto que quedó colgado: se ofrece seguir con él. */
      openMoodName: string | null;
      recentNames: string[];
      busy: boolean;
      error: string | null;
      onPick: (name: string) => void;
      onSkip: () => void;
    }
  | {
      mode: "close";
      initialName: string;
      /** Ej. "1 h 20" — cuánto duró ese mood. */
      durationLabel: string | null;
      /** Texto del botón principal ("Guardar", "Guardar y elegir el nuevo"). */
      saveLabel: string;
      busy: boolean;
      error: string | null;
      onSave: (value: { mood: string; score: MoodScore | null; note: string }) => void;
      onSkip: () => void;
    };

function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export default function MoodPromptModal(props: MoodPromptProps) {
  const { busy, error, onSkip } = props;
  const [draft, setDraft] = useState(props.mode === "close" ? props.initialName : "");
  const [score, setScore] = useState<MoodScore | null>(null);
  const [note, setNote] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // En "close" con nombre ya puesto, el foco no va al input así funcionan las teclas 1–5.
    if (props.mode === "start" || !props.initialName) inputRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al abrir
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!busy) onSkip();
        return;
      }
      if (props.mode !== "close" || isTypingTarget(event.target)) return;
      const n = Number(event.key);
      if (n >= 1 && n <= 5) {
        event.preventDefault();
        setScore(n as MoodScore);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onSkip, props.mode]);

  const submit = () => {
    if (busy) return;
    const name = draft.trim().slice(0, MOOD_MAX);
    if (props.mode === "start") {
      if (name) props.onPick(name);
      return;
    }
    if (!name) {
      inputRef.current?.focus();
      return;
    }
    props.onSave({ mood: name, score, note: note.trim().slice(0, MOOD_NOTE_MAX) });
  };

  const title = props.mode === "start" ? "¿Qué tenés de fondo?" : "¿Cómo mantuviste la mente?";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onSkip();
      }}
    >
      <article
        role="dialog"
        aria-modal="true"
        aria-labelledby="mood-prompt-title"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.22)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 id="mood-prompt-title" className="inline-flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Headphones className="h-5 w-5 text-blue-600" />
            {title}
          </h2>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            aria-label="Cerrar"
            className="rounded-lg p-1.5 text-slate-400 cursor-pointer disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-4 px-5 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {props.mode === "start" && (props.openMoodName || props.recentNames.length > 0) ? (
            <div className="flex flex-wrap gap-2">
              {props.openMoodName ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => props.onPick(props.openMoodName as string)}
                  className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1.5 text-sm font-semibold text-blue-800 cursor-pointer disabled:opacity-50"
                >
                  Seguir con {props.openMoodName}
                </button>
              ) : null}
              {props.recentNames
                .filter((name) => name.toLowerCase() !== props.openMoodName?.toLowerCase())
                .map((name) => (
                  <button
                    key={name}
                    type="button"
                    disabled={busy}
                    onClick={() => props.onPick(name)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    {name}
                  </button>
                ))}
            </div>
          ) : null}

          <label className="block text-xs font-semibold text-slate-800">
            Mood
            {props.mode === "close" && props.durationLabel ? (
              <span className="font-medium text-slate-500"> · {props.durationLabel}</span>
            ) : null}
            <input
              ref={inputRef}
              type="text"
              value={draft}
              maxLength={MOOD_MAX}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="pomodoro with tonich"
              className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base font-semibold text-slate-950 placeholder:font-medium placeholder:text-slate-400"
            />
          </label>

          {props.mode === "close" ? (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-800">
                  Mente
                  <span className="font-medium text-slate-500"> · teclas 1–5</span>
                </p>
                <div className="mt-1 grid grid-cols-5 gap-2">
                  {SCORES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={score === value}
                      title={SCORE_HINT[value]}
                      onClick={() => setScore(score === value ? null : value)}
                      className={`rounded-xl border py-2 text-base font-bold cursor-pointer ${
                        score === value
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                <p className="mt-1 h-4 text-xs font-medium text-slate-500">
                  {score ? SCORE_HINT[score] : ""}
                </p>
              </div>

              <label className="block text-xs font-semibold text-slate-800">
                Nota
                <span className="font-medium text-slate-500"> · opcional</span>
                <textarea
                  value={note}
                  maxLength={MOOD_NOTE_MAX}
                  rows={2}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Ej. me distraje con el celu a la mitad"
                  className="mt-1 block w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-950 placeholder:text-slate-400"
                />
              </label>
            </>
          ) : null}

          {error ? <p className="text-sm font-medium text-rose-700">{error}</p> : null}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onSkip}
              disabled={busy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 cursor-pointer disabled:opacity-50"
            >
              {props.mode === "start" ? "Sin mood" : "Saltear"}
            </button>
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white cursor-pointer disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {props.mode === "start" ? "Arrancar" : props.saveLabel}
            </button>
          </div>
        </form>
      </article>
    </div>
  );
}
