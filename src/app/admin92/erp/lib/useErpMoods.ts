"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { todayYmd } from "@/app/admin92/contabilidad/lib/utils";
import {
  recentMoodNames,
  type ErpMood,
  type MoodPatch,
} from "@/app/admin92/erp/lib/erpHabitos";

/** HH:MM local (formato que guarda erp-moods). */
export function clockNow(date: Date = new Date()): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/*
 * Store de módulo: el timer live y Hábitos comparten la misma lista de moods,
 * así un mood arrancado desde el timer se ve al instante en Hábitos y viceversa.
 */
type MoodsState = { moods: ErpMood[]; loaded: boolean };
let state: MoodsState = { moods: [], loaded: false };
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;

function setState(next: MoodsState) {
  state = next;
  for (const listener of listeners) listener();
}

function setMoods(update: (prev: ErpMood[]) => ErpMood[]) {
  setState({ ...state, moods: update(state.moods) });
}

function upsert(saved: ErpMood) {
  setMoods((prev) => [...prev.filter((row) => row._id !== saved._id), saved]);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;
const SERVER_STATE: MoodsState = { moods: [], loaded: false };
const getServerSnapshot = () => SERVER_STATE;

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || fallback);
  return data;
}

export async function reloadMoods(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const response = await fetch("/api/admin/erp-moods", { cache: "no-store" });
      const data = await readJson<{ moods?: ErpMood[] }>(response, "No se pudieron cargar los moods.");
      setState({ moods: data.moods ?? [], loaded: true });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

async function postMood(body: Record<string, unknown>): Promise<ErpMood> {
  const response = await fetch("/api/admin/erp-moods", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<{ mood?: ErpMood }>(response, "No se pudo arrancar el mood.");
  if (!data.mood) throw new Error("No se pudo arrancar el mood.");
  upsert(data.mood);
  return data.mood;
}

async function patchMood(body: Record<string, unknown>): Promise<ErpMood> {
  const response = await fetch("/api/admin/erp-moods", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await readJson<{ mood?: ErpMood }>(response, "No se pudo guardar el mood.");
  if (!data.mood) throw new Error("No se pudo guardar el mood.");
  upsert(data.mood);
  return data.mood;
}

export type MoodClose = MoodPatch & {
  /** HH:MM de cierre; por defecto ahora. */
  endedAt?: string;
};

export function useErpMoods() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const today = todayYmd();
  const openMood = useMemo(
    () => snapshot.moods.find((row) => row.date === today && row.endedAt === null) ?? null,
    [snapshot.moods, today],
  );
  const recentNames = useMemo(() => recentMoodNames(snapshot.moods), [snapshot.moods]);

  /** Abre un mood ahora (falla si ya hay uno abierto hoy). */
  const start = useCallback(
    (mood: string, startedAt: string = clockNow()) =>
      postMood({ date: todayYmd(), mood, startedAt }),
    [],
  );

  /** Cierra el mood abierto con puntaje/nota (y nombre corregido, si vino). */
  const close = useCallback(
    async (target: ErpMood, { endedAt, ...patch }: MoodClose = {}) =>
      patchMood({ id: target._id, endedAt: endedAt ?? clockNow(), ...patch }),
    [],
  );

  /** Crea un mood ya cerrado (ej. puntuado al pausar sin haber elegido uno al arrancar). */
  const createClosed = useCallback(
    (input: { mood: string; startedAt: string; endedAt?: string; score?: MoodPatch["score"]; note?: string }) =>
      postMood({
        date: todayYmd(),
        mood: input.mood,
        startedAt: input.startedAt,
        endedAt: input.endedAt ?? clockNow(),
        score: input.score ?? null,
        note: input.note ?? "",
      }),
    [],
  );

  /** Edita mood/score/note sin tocar horarios. */
  const update = useCallback(
    (target: ErpMood, patch: MoodPatch) => patchMood({ id: target._id, ...patch }),
    [],
  );

  /** Cambio en medio de una racha: cierra el actual y abre el nuevo a la misma hora. */
  const switchTo = useCallback(async (target: ErpMood, closing: MoodPatch, next: string) => {
    const at = clockNow();
    await patchMood({ id: target._id, endedAt: at, ...closing });
    return postMood({ date: todayYmd(), mood: next, startedAt: at });
  }, []);

  const remove = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/erp-moods?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    await readJson(response, "No se pudo quitar el mood.");
    setMoods((prev) => prev.filter((row) => row._id !== id));
  }, []);

  return {
    moods: snapshot.moods,
    loaded: snapshot.loaded,
    openMood,
    recentNames,
    reload: reloadMoods,
    start,
    close,
    createClosed,
    update,
    switchTo,
    remove,
  };
}
