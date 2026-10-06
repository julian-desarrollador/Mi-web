"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatCurrency } from "@/app/admin92/contabilidad/lib/utils";
import type { ErpPeriod } from "@/app/admin92/erp/lib/erpAggregates";
import {
  elapsedActiveSeconds,
  formatHoursAsHm,
  normalizeActiveWorkTimer,
  normalizeWorkTimers,
  repartidoSecondsForClient,
  WORK_CATEGORY_META,
  type ErpActiveWorkTimer,
  type ErpDayLog,
  type WorkCategoryKey,
} from "@/app/admin92/erp/lib/erpTypes";

type CobroRow = {
  clientName: string;
  amount: number;
  paid?: boolean;
  dueDate?: string;
  paidAt?: string;
  fechaCobro?: string;
};

type Props = {
  period: ErpPeriod;
  periodLogs: ErpDayLog[];
  periodDates: string[];
  activeWorkTimer?: ErpActiveWorkTimer | null;
  countsLiveTimer?: boolean;
  liveNowMs: number;
};

const CATEGORY_KEYS = WORK_CATEGORY_META.map((c) => c.key);

function nameKey(value: string): string {
  return value.trim().toLowerCase();
}

function cobroYmd(cobro: CobroRow): string {
  const raw = cobro.fechaCobro || cobro.paidAt || cobro.dueDate || "";
  return raw.slice(0, 10);
}

function rateLabel(seconds: number, amount: number): string {
  if (amount <= 0) return "Sin ingresos todavía";
  if (seconds <= 0) return "Sin horas";
  return formatCurrency(amount / (seconds / 3600));
}

export default function WorkProjectsPanel({
  period,
  periodLogs,
  periodDates,
  activeWorkTimer = null,
  countsLiveTimer = false,
  liveNowMs,
}: Props) {
  const [cobros, setCobros] = useState<CobroRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setGuideOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [guideOpen]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/cobros")
      .then((res) => res.json())
      .then((data: { cobros?: CobroRow[]; error?: string }) => {
        if (cancelled) return;
        if (!Array.isArray(data.cobros)) {
          setError(data.error || "No se pudieron cargar las cuotas");
          return;
        }
        setCobros(data.cobros);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudieron cargar las cuotas");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = useMemo(() => {
    const cuotaSeconds = new Map<string, { name: string; focus: number; repartido: number }>();
    let promesa = 0;
    let conocimiento = 0;
    let unmarked = 0;

    const addFocus = (clientName: string, seconds: number) => {
      const key = nameKey(clientName);
      if (!key || seconds <= 0) return;
      const prev = cuotaSeconds.get(key);
      cuotaSeconds.set(key, {
        name: prev?.name || clientName.trim(),
        focus: (prev?.focus ?? 0) + seconds,
        repartido: prev?.repartido ?? 0,
      });
    };

    const addRepartido = (clientName: string, seconds: number) => {
      const key = nameKey(clientName);
      if (!key || seconds <= 0) return;
      const prev = cuotaSeconds.get(key);
      cuotaSeconds.set(key, {
        name: prev?.name || clientName.trim(),
        focus: prev?.focus ?? 0,
        repartido: (prev?.repartido ?? 0) + seconds,
      });
    };

    const add = (timer: {
      seconds: number;
      cuotaClient?: string;
      cuotaClients?: string[];
      share?: string;
      timeKind?: string;
    }) => {
      if (timer.seconds <= 0) return;
      if (timer.share === "repartido" && timer.cuotaClients && timer.cuotaClients.length >= 2) {
        for (const client of timer.cuotaClients) {
          addRepartido(client, repartidoSecondsForClient(timer.cuotaClients, timer.seconds, client));
        }
        return;
      }
      if (timer.cuotaClient) {
        addFocus(timer.cuotaClient, timer.seconds);
        return;
      }
      if (timer.timeKind === "promesa") {
        promesa += timer.seconds;
        return;
      }
      if (timer.timeKind === "conocimiento") {
        conocimiento += timer.seconds;
        return;
      }
      unmarked += timer.seconds;
    };

    for (const log of periodLogs) {
      const timers = normalizeWorkTimers(log.workTimers);
      for (const key of CATEGORY_KEYS as WorkCategoryKey[]) {
        for (const timer of timers[key]) add(timer);
      }
    }

    const active = countsLiveTimer ? normalizeActiveWorkTimer(activeWorkTimer) : null;
    if (active) {
      add({
        seconds: elapsedActiveSeconds(active, liveNowMs),
        cuotaClient: active.cuotaClient,
        cuotaClients: active.cuotaClients,
        share: active.share,
        timeKind: active.timeKind,
      });
    }

    const from = periodDates[0] ?? "";
    const to = periodDates[periodDates.length - 1] ?? "";
    const money = new Map<string, number>();
    for (const cobro of cobros) {
      if (!cobro.paid) continue;
      const date = cobroYmd(cobro);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < from || date > to) continue;
      const key = nameKey(cobro.clientName || "");
      if (!key || !cuotaSeconds.has(key)) continue;
      money.set(key, (money.get(key) ?? 0) + Number(cobro.amount || 0));
    }

    const cuotas = [...cuotaSeconds.entries()]
      .map(([key, row]) => ({
        name: row.name,
        seconds: row.focus,
        repartido: row.repartido,
        amount: money.get(key) ?? 0,
      }))
      .sort(
        (a, b) =>
          b.seconds + b.repartido - (a.seconds + a.repartido) || a.name.localeCompare(b.name, "es"),
      );

    return { cuotas, promesa, conocimiento, unmarked };
  }, [periodLogs, periodDates, cobros, countsLiveTimer, activeWorkTimer, liveNowMs]);

  const empty =
    summary.cuotas.length === 0 &&
    summary.promesa === 0 &&
    summary.conocimiento === 0 &&
    summary.unmarked === 0;

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setGuideOpen(true)}
        className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
      >
        Cómo usarlo
      </button>
      {loading ? (
        <p className="text-sm text-slate-600">Cargando…</p>
      ) : (
        <>
      <p className="text-xs font-medium text-slate-600">
        La plata es lo cobrado de esa cuota en este período. Para decidir, mirá el mes.
      </p>
      {period === "week" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
          En la semana, la plata depende de qué días cayeron los cobros. El número que sirve para decidir es el del mes.
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      {empty ? (
        <p className="text-sm text-slate-600">
          En este período no hay horas. Al iniciar un timer podés marcarlo como cuota, promesa o conocimiento.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left">
                <th className="py-2 pr-3 font-semibold text-slate-700">Destino</th>
                <th className="py-2 pr-3 font-semibold text-slate-700">Horas</th>
                <th className="py-2 pr-3 font-semibold text-slate-700">Cobrado</th>
                <th className="py-2 font-semibold text-slate-700">Plata por hora</th>
              </tr>
            </thead>
            <tbody>
              {summary.cuotas.map((row) => (
                <tr key={row.name} className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-950">{row.name}</p>
                    <p className="text-xs text-slate-600">Cuota</p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-800">
                    <p>{formatHoursAsHm(row.seconds / 3600)} hs</p>
                    {row.repartido > 0 ? (
                      <p className="text-xs font-medium text-slate-900">
                        {formatHoursAsHm(row.repartido / 3600)} rep
                      </p>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-800">
                    {row.amount > 0 ? formatCurrency(row.amount) : "Sin ingresos todavía"}
                  </td>
                  <td className="py-2 font-semibold text-slate-950">{rateLabel(row.seconds, row.amount)}</td>
                </tr>
              ))}
              {summary.promesa > 0 ? (
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-950">Promesa</p>
                    <p className="text-xs text-slate-600">Sin cuota todavía</p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-800">
                    {formatHoursAsHm(summary.promesa / 3600)} hs
                  </td>
                  <td className="py-2 pr-3 text-slate-500">—</td>
                  <td className="py-2 text-slate-500">—</td>
                </tr>
              ) : null}
              {summary.conocimiento > 0 ? (
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-950">Conocimiento</p>
                    <p className="text-xs text-slate-600">Después puede mejorar el negocio</p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-800">
                    {formatHoursAsHm(summary.conocimiento / 3600)} hs
                  </td>
                  <td className="py-2 pr-3 text-slate-500">—</td>
                  <td className="py-2 text-slate-500">—</td>
                </tr>
              ) : null}
              {summary.unmarked > 0 ? (
                <tr className="border-b border-slate-100">
                  <td className="py-2 pr-3">
                    <p className="font-semibold text-slate-950">Sin marcar</p>
                    <p className="text-xs text-slate-600">Horas de antes, sin destino</p>
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-slate-800">
                    {formatHoursAsHm(summary.unmarked / 3600)} hs
                  </td>
                  <td className="py-2 pr-3 text-slate-500">—</td>
                  <td className="py-2 text-slate-500">—</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
      {guideOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setGuideOpen(false);
          }}
        >
          <article
            role="dialog"
            aria-modal="true"
            aria-labelledby="para-que-guide-title"
            className="max-h-[min(36rem,90vh)] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.22)] sm:p-8"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <h2 id="para-que-guide-title" className="text-lg font-semibold leading-snug text-slate-950 sm:text-xl">
                Cómo usar Para qué
              </h2>
              <button
                type="button"
                onClick={() => setGuideOpen(false)}
                aria-label="Cerrar"
                className="shrink-0 cursor-pointer rounded-lg p-1.5 text-slate-700 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 text-sm leading-relaxed text-slate-800">
              <p>
                El crecimiento sale de la próxima cuota y de empujar un solo producto. Esta pantalla muestra si la
                semana se fue a eso. Se mira una vez por mes.
              </p>
              <ul className="space-y-3">
                <li>
                  <strong className="font-semibold text-slate-950">Cuota</strong> es el piso: horas de clientes que ya
                  pagan.
                </li>
                <li>
                  <strong className="font-semibold text-slate-950">Promesa</strong> es la apuesta: SaaS, Hippo cuando el
                  trabajo es para que crezca, y el video o marketing para traer clientes que todavía no están. Si un mes
                  se lleva la mayor parte de la semana y no aparece una cuota nueva, la apuesta está grande.
                </li>
                <li>
                  <strong className="font-semibold text-slate-950">Conocimiento</strong> es aprendizaje. Si se come la
                  semana, esa semana Glomun no creció.
                </li>
              </ul>
              <p>
                Un video para un cliente que ya paga va en la cuota de ese cliente, con la categoría Branding /
                Marketing.
              </p>
              <p>
                Cuota, promesa y conocimiento alcanzan: lo que paga, lo que puede pagar después y lo que es estudio.
              </p>
              <p>
                Lo que mueve el número es elegir una sola promesa por mes, dejar horas fijas para una pieza de marketing
                marcada como promesa, y revisar en pesos si las cuotas actuales siguen alcanzando.
              </p>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
}
