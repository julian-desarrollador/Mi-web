"use client";

import { useCallback, useEffect, useState } from "react";

export type MejoraGeneralAplicacion = {
  clientName: string;
  servicio?: string;
  done: boolean;
  fechaRealizada?: string;
};

export type MejoraGeneral = {
  id: string;
  text: string;
  createdAt: string;
  aplicaciones: MejoraGeneralAplicacion[];
};

export type AplicacionRef = {
  clientName: string;
  servicio?: string;
};

const listeners = new Set<() => void>();

export function subscribeMejorasGenerales(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyMejorasGenerales() {
  listeners.forEach((listener) => listener());
}

export function aplicacionKey(app: AplicacionRef): string {
  return `${app.clientName.trim().toLowerCase()}|${(app.servicio ?? "").trim().toLowerCase()}`;
}

export function mismaAplicacion(a: AplicacionRef, b: AplicacionRef): boolean {
  return aplicacionKey(a) === aplicacionKey(b);
}

export function etiquetaAplicacion(app: AplicacionRef): string {
  const servicio = app.servicio?.trim();
  return servicio ? `${app.clientName} (${servicio})` : app.clientName;
}

/** Abierta si todavía no tiene aplicaciones, o si alguna sigue sin hacer. */
export function mejoraGeneralAbierta(mejora: MejoraGeneral): boolean {
  return mejora.aplicaciones.length === 0 || mejora.aplicaciones.some((app) => !app.done);
}

export function appsDesdeCobros(cobros: AplicacionRef[]): AplicacionRef[] {
  const map = new Map<string, AplicacionRef>();
  for (const cobro of cobros) {
    const clientName = cobro.clientName.trim();
    if (!clientName) continue;
    const servicio = cobro.servicio?.trim() || undefined;
    const app = { clientName, ...(servicio ? { servicio } : {}) };
    const key = aplicacionKey(app);
    if (!map.has(key)) map.set(key, app);
  }
  return [...map.values()].sort((a, b) =>
    etiquetaAplicacion(a).localeCompare(etiquetaAplicacion(b), "es"),
  );
}

function mapApi(raw: {
  _id?: string;
  id?: string;
  text: string;
  createdAt: string;
  aplicaciones?: MejoraGeneralAplicacion[];
}): MejoraGeneral {
  return {
    id: raw._id ?? raw.id ?? "",
    text: raw.text,
    createdAt: raw.createdAt,
    aplicaciones: raw.aplicaciones ?? [],
  };
}

export function useMejorasGenerales() {
  const [items, setItems] = useState<MejoraGeneral[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/mejoras-generales", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudieron cargar las mejoras generales.");
      setItems((data.mejoras ?? []).map(mapApi));
      setError("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las mejoras generales.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return subscribeMejorasGenerales(() => {
      void reload();
    });
  }, [reload]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setSaving(true);
    setError("");
    try {
      await work();
      notifyMejorasGenerales();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }, []);

  const add = useCallback(
    (text: string) =>
      run(async () => {
        const res = await fetch("/api/admin/mejoras-generales", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No se pudo guardar la mejora.");
      }),
    [run],
  );

  const remove = useCallback(
    (id: string) =>
      run(async () => {
        const res = await fetch(`/api/admin/mejoras-generales/${id}`, { method: "DELETE" });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No se pudo eliminar la mejora.");
      }),
    [run],
  );

  const setAplicaciones = useCallback(
    (id: string, aplicaciones: MejoraGeneralAplicacion[]) =>
      run(async () => {
        const res = await fetch(`/api/admin/mejoras-generales/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ aplicaciones }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "No se pudo actualizar la mejora.");
      }),
    [run],
  );

  return { items, loading, saving, error, add, remove, setAplicaciones };
}
