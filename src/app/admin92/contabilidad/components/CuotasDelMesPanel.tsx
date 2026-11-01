"use client";

import { Fragment, useMemo, useState } from "react";
import { Calendar, Check, Copy, FileText, Pencil, Search, Trash2, X } from "lucide-react";
import { getRemindersToday, getRemindersWeekBefore, getStatsOverdue, getStatsToday } from "@/app/lib/cobrosWorkflow";
import { formatRecordatorioMensaje, MENSAJE_ESTADISTICAS, MENSAJE_RECORDATORIO_PAGO } from "@/app/lib/cobrosMensajes";
import ChambaToggle from "@/app/admin92/contabilidad/components/ChambaToggle";
import ConfirmarPagoCobro from "@/app/admin92/contabilidad/components/ConfirmarPagoCobro";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import {
  formatLocalDate,
  formatMonthLabel,
  getMonthKey,
  getMonthKeySafe,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";

const SERVICIO_OPTIONS = ["", "App", "Tienda", "Web", "Mantenimiento", "Otro"] as const;

const WORD_ONLINE_URL =
  process.env.NEXT_PUBLIC_ENLACE_WORD?.trim() ||
  process.env.NEXT_PUBLIC_PROYECTOS_WORD_URL?.trim() ||
  "";

/** Campos de la cuota que usa el cuadro (compatible con /api/admin/cobros). */
export type CuotaDelMes = {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidAt?: string;
  fechaCobro?: string;
  servicio?: string;
  descripcionCuota?: string;
  origen?: "manual" | "suscripcion_mp";
  estadisticasEnviadas?: boolean;
  fechaEnvioEstadisticas?: string;
  recordatorioEnviado?: boolean;
  requiereEstadisticas?: boolean;
  accountingRecordId?: string;
  chamba?: boolean;
};

type Props<C extends CuotaDelMes> = {
  cobros: C[];
  /** Mes YYYY-MM que lista la tabla */
  month: string;
  requiereStatsByClient: Map<string, boolean>;
  loading: boolean;
  /** Error del contenedor (p. ej. al cargar) */
  error?: string;
  /** Recargar datos: botón Actualizar y después de cada cambio */
  onReload: () => void | Promise<void>;
  /** Si se pasan, el contenedor maneja la confirmación; si no, se confirma acá mismo. */
  onTogglePaid?: (c: C) => void;
  onToggleEstadisticas?: (c: C) => void;
};

/** Minúsculas y sin acentos, para buscar sin importar cómo se escribió. */
function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatCurrency(n: number): string {
  return `$${n.toLocaleString("es-AR")} ARS`;
}

function todayLocalYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function dueDateInMonth(dueDate: string, targetYm: string): string {
  const day = Number(dueDate.slice(8, 10));
  const [y, m] = targetYm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return `${targetYm}-${String(Math.min(day, last)).padStart(2, "0")}`;
}

async function readError(res: Response, fallback: string): Promise<string | null> {
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string })?.error || fallback;
}

/**
 * Cuadro "Cuotas del mes" de Contabilidad: alta única/recurrente, acciones de hoy,
 * filtros y tabla con pagado, recordatorio, estadísticas, chamba, copiar, editar y eliminar.
 */
export default function CuotasDelMesPanel<C extends CuotaDelMes>({
  cobros,
  month,
  requiereStatsByClient,
  loading,
  error,
  onReload,
  onTogglePaid,
  onToggleEstadisticas,
}: Props<C>) {
  const [cobroError, setCobroError] = useState("");
  const [cobroSubmitting, setCobroSubmitting] = useState(false);
  const [cobroFormMode, setCobroFormMode] = useState<"single" | "recurrent" | "actions">("single");
  const [showSingleCobroForm, setShowSingleCobroForm] = useState(false);
  const [cobroClient, setCobroClient] = useState("");
  const [cobroAmount, setCobroAmount] = useState("");
  const [cobroServicio, setCobroServicio] = useState("");
  const [cobroOrigen, setCobroOrigen] = useState<"manual" | "suscripcion_mp">("manual");
  const [cobroDueDate, setCobroDueDate] = useState(todayLocalYmd);
  const [cobroDayOfMonth, setCobroDayOfMonth] = useState("1");
  const [cobroFromMonth, setCobroFromMonth] = useState(currentMonthKey);
  const [cobroMonthsToGenerate, setCobroMonthsToGenerate] = useState("12");
  const [copyRow, setCopyRow] = useState<{ id: string; month: string } | null>(null);
  const [cobroChamba, setCobroChamba] = useState(false);
  const [editingCobro, setEditingCobro] = useState<C | null>(null);
  const [editCobroAmount, setEditCobroAmount] = useState("");
  const [editCobroServicio, setEditCobroServicio] = useState("");
  const [editCobroDueDate, setEditCobroDueDate] = useState("");
  const [editCobroUpdateFuture, setEditCobroUpdateFuture] = useState(false);
  const [cobroFilterClient, setCobroFilterClient] = useState("");
  const [cobroFilterPaid, setCobroFilterPaid] = useState<"" | "paid" | "pending">("");
  const [cobroFilterOrigen, setCobroFilterOrigen] = useState<"" | "manual" | "suscripcion_mp">("");
  const [cobroSearch, setCobroSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  // Confirmaciones propias (solo si el contenedor no las maneja)
  const [pendingPaidCobro, setPendingPaidCobro] = useState<C | null>(null);
  const [paidFechaIngreso, setPaidFechaIngreso] = useState("");
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const [pendingStatsCobro, setPendingStatsCobro] = useState<C | null>(null);
  const [statsFechaEnvio, setStatsFechaEnvio] = useState("");
  const [confirmingStats, setConfirmingStats] = useState(false);

  const shownError = cobroError || error || "";
  const cobroLoading = loading;

  // Meses para formulario de cuotas recurrentes (desde hace 12 meses hasta +24)
  const cobroMonthOptions = useMemo(() => {
    const now = new Date();
    const options: string[] = [];
    for (let i = -12; i <= 24; i++) {
      options.push(getMonthKey(new Date(now.getFullYear(), now.getMonth() + i, 1)));
    }
    return options;
  }, []);

  const cobroClients = useMemo(
    () => Array.from(new Set(cobros.map((c) => c.clientName))).sort(),
    [cobros],
  );

  const filteredCobros = useMemo(() => {
    let list = cobros.filter((c) => getMonthKeySafe(c.dueDate) === month);
    if (cobroFilterClient) list = list.filter((c) => c.clientName === cobroFilterClient);
    if (cobroFilterPaid === "paid") list = list.filter((c) => c.paid);
    if (cobroFilterPaid === "pending") list = list.filter((c) => !c.paid);
    if (cobroFilterOrigen) list = list.filter((c) => (c.origen ?? "manual") === cobroFilterOrigen);
    const terms = normalizeSearch(cobroSearch).split(/\s+/).filter(Boolean);
    if (terms.length > 0) {
      list = list.filter((c) => {
        const haystack = normalizeSearch(
          [
            c.clientName,
            c.servicio,
            c.descripcionCuota,
            c.dueDate,
            formatLocalDate(c.dueDate),
            String(c.amount),
            c.amount.toLocaleString("es-AR"),
          ]
            .filter(Boolean)
            .join(" "),
        );
        return terms.every((t) => haystack.includes(t));
      });
    }
    return [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [cobros, cobroFilterClient, month, cobroFilterPaid, cobroFilterOrigen, cobroSearch]);

  const totalCobrosFiltrados = useMemo(
    () => filteredCobros.reduce((sum, c) => sum + c.amount, 0),
    [filteredCobros],
  );

  const remindersToday = useMemo(() => getRemindersToday(cobros), [cobros]);
  const remindersWeekBefore = useMemo(() => getRemindersWeekBefore(cobros), [cobros]);
  const statsToday = useMemo(
    () => getStatsToday(cobros, undefined, requiereStatsByClient),
    [cobros, requiereStatsByClient],
  );
  const statsOverdue = useMemo(
    () => getStatsOverdue(cobros, undefined, requiereStatsByClient),
    [cobros, requiereStatsByClient],
  );

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /** PATCH a una cuota; devuelve true si salió bien. */
  const patchCobro = async (id: string, body: Record<string, unknown>, fallback: string) => {
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const err = await readError(res, fallback);
      if (err) {
        setCobroError(err);
        return false;
      }
      await onReload();
      return true;
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : fallback);
      return false;
    }
  };

  const postCobros = async (body: Record<string, unknown>, fallback: string) => {
    setCobroSubmitting(true);
    setCobroError("");
    try {
      const res = await fetch("/api/admin/cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const err = await readError(res, fallback);
      if (err) {
        setCobroError(err);
        return false;
      }
      await onReload();
      return true;
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al guardar.");
      return false;
    } finally {
      setCobroSubmitting(false);
    }
  };

  const resetAltaForm = () => {
    setCobroClient("");
    setCobroAmount("");
    setCobroServicio("");
    setCobroOrigen("manual");
    setCobroChamba(false);
  };

  const handleAddSingleCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cobroAmount);
    if (!cobroClient.trim() || isNaN(amount) || amount <= 0) return;
    const ok = await postCobros(
      {
        clientName: cobroClient.trim(),
        amount,
        dueDate: cobroDueDate,
        servicio: cobroServicio || undefined,
        origen: cobroOrigen,
        paid: false,
        ...(cobroChamba ? { chamba: true } : {}),
      },
      "No se pudo guardar.",
    );
    if (!ok) return;
    resetAltaForm();
    setCobroDueDate(todayLocalYmd());
  };

  const handleAddRecurrentCobros = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cobroAmount);
    const day = Math.min(31, Math.max(1, parseInt(cobroDayOfMonth, 10) || 1));
    const months = Math.min(60, Math.max(1, parseInt(cobroMonthsToGenerate, 10) || 12));
    if (!cobroClient.trim() || isNaN(amount) || amount <= 0) return;
    const [y, m] = cobroFromMonth.split("-").map(Number);
    const toInsert: Record<string, unknown>[] = [];
    for (let i = 0; i < months; i++) {
      const d = new Date(y, m - 1 + i, Math.min(day, new Date(y, m + i, 0).getDate()));
      const dueDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const exists = cobros.some((c) => c.clientName === cobroClient.trim() && c.dueDate === dueDate);
      if (!exists) {
        toInsert.push({
          clientName: cobroClient.trim(),
          amount,
          dueDate,
          servicio: cobroServicio || undefined,
          origen: cobroOrigen,
          ...(cobroChamba ? { chamba: true } : {}),
        });
      }
    }
    if (toInsert.length === 0) {
      setCobroError("Todas las cuotas ya existen.");
      return;
    }
    const ok = await postCobros({ cobros: toInsert }, "No se pudieron guardar las cuotas.");
    if (!ok) return;
    resetAltaForm();
    setCobroDayOfMonth("1");
    setCobroFromMonth(currentMonthKey());
    setCobroMonthsToGenerate("12");
  };

  const handleCopyCobroToMonth = async (c: C, targetYm: string) => {
    const dueDate = dueDateInMonth(c.dueDate, targetYm);
    if (cobros.some((row) => row.clientName === c.clientName && row.dueDate === dueDate)) {
      setCobroError("Esa cuota ya existe en ese mes.");
      return;
    }
    const ok = await postCobros(
      {
        cobros: [
          {
            clientName: c.clientName,
            amount: c.amount,
            dueDate,
            servicio: c.servicio || undefined,
            origen: c.origen === "suscripcion_mp" ? "suscripcion_mp" : "manual",
            ...(c.chamba ? { chamba: true } : {}),
          },
        ],
      },
      "No se pudo copiar la cuota.",
    );
    if (ok) setCopyRow(null);
  };

  const handleToggleCobroChamba = (c: C) =>
    patchCobro(c.id, { chamba: c.chamba !== true }, "No se pudo marcar la cuota.");

  const handleToggleRecordatorio = (c: C) =>
    patchCobro(c.id, { recordatorioEnviado: !c.recordatorioEnviado }, "No se pudo actualizar.");

  const handleTogglePaid = (c: C) => {
    if (onTogglePaid) {
      onTogglePaid(c);
      return;
    }
    if (c.paid) {
      void patchCobro(c.id, { paid: false }, "No se pudo actualizar.");
      return;
    }
    setPendingPaidCobro(c);
    setPaidFechaIngreso(todayYmd());
  };

  const handleConfirmMarkPaid = async () => {
    if (!pendingPaidCobro) return;
    setConfirmingPaid(true);
    const ok = await patchCobro(
      pendingPaidCobro.id,
      { paid: true, fechaIngreso: paidFechaIngreso },
      "No se pudo actualizar.",
    );
    setConfirmingPaid(false);
    if (!ok) return;
    setPendingPaidCobro(null);
    setPaidFechaIngreso("");
  };

  const handleToggleEstadisticas = (c: C) => {
    if (onToggleEstadisticas) {
      onToggleEstadisticas(c);
      return;
    }
    if (c.estadisticasEnviadas) {
      void patchCobro(c.id, { estadisticasEnviadas: false }, "No se pudo actualizar.");
      return;
    }
    setPendingStatsCobro(c);
    setStatsFechaEnvio(todayYmd());
  };

  const handleConfirmStatsEnviadas = async () => {
    if (!pendingStatsCobro) return;
    setConfirmingStats(true);
    const ok = await patchCobro(
      pendingStatsCobro.id,
      { estadisticasEnviadas: true, fechaEnvioEstadisticas: statsFechaEnvio },
      "No se pudo actualizar.",
    );
    setConfirmingStats(false);
    if (!ok) return;
    setPendingStatsCobro(null);
    setStatsFechaEnvio("");
  };

  const handleEditCobro = (c: C) => {
    setEditingCobro(c);
    setEditCobroAmount(String(c.amount));
    setEditCobroServicio(c.servicio || "");
    setEditCobroDueDate(c.dueDate);
    setEditCobroUpdateFuture(false);
  };

  const handleCancelEditCobro = () => {
    setEditingCobro(null);
    setEditCobroAmount("");
    setEditCobroServicio("");
    setEditCobroDueDate("");
    setEditCobroUpdateFuture(false);
  };

  const handleSaveEditCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCobro) return;
    const newAmount = parseFloat(editCobroAmount);
    if (isNaN(newAmount) || newAmount <= 0) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(editCobroDueDate)) {
      setCobroError("La fecha debe tener formato YYYY-MM-DD.");
      return;
    }
    setCobroSubmitting(true);
    const ok = await patchCobro(
      editingCobro.id,
      {
        amount: newAmount,
        servicio: editCobroServicio || undefined,
        dueDate: editCobroDueDate,
        updateFuture: editCobroUpdateFuture,
        clientName: editCobroUpdateFuture ? editingCobro.clientName : undefined,
        dueDateFrom: editCobroUpdateFuture ? editingCobro.dueDate : undefined,
      },
      "No se pudo actualizar.",
    );
    setCobroSubmitting(false);
    if (ok) handleCancelEditCobro();
  };

  const handleDeleteCobro = async (c: C) => {
    if (!window.confirm(`¿Eliminar cuota de ${c.clientName} - ${formatLocalDate(c.dueDate)} - $${c.amount.toLocaleString("es-AR")}?`)) return;
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${c.id}`, { method: "DELETE" });
      const err = await readError(res, "No se pudo eliminar.");
      if (err) {
        setCobroError(err);
        return;
      }
      await onReload();
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al eliminar.");
    }
  };

  const handleDeleteAllCobrosOfClient = async (clientName: string) => {
    if (!window.confirm(`¿Eliminar todas las cuotas de ${clientName}?`)) return;
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros?client=${encodeURIComponent(clientName)}`, { method: "DELETE" });
      const err = await readError(res, "No se pudieron eliminar.");
      if (err) {
        setCobroError(err);
        return;
      }
      setCobroFilterClient("");
      await onReload();
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al eliminar.");
    }
  };

  return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Cuotas del mes</h2>
                <div className="flex items-center gap-3">
                  {WORD_ONLINE_URL ? (
                    <a
                      href={WORD_ONLINE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-[#84b9ed]" aria-hidden />
                      Word online
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void onReload()}
                    disabled={cobroLoading}
                    className="text-sm font-medium text-[#84b9ed] hover:text-[#6ba3d9] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {cobroLoading ? "Cargando..." : "Actualizar"}
                  </button>
                </div>
              </div>
              {shownError && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
                  {shownError}
                </div>
              )}

              {pendingPaidCobro && (
                <ConfirmarPagoCobro
                  cobro={pendingPaidCobro}
                  fechaCobro={paidFechaIngreso}
                  onFechaCobroChange={setPaidFechaIngreso}
                  onConfirm={handleConfirmMarkPaid}
                  onCancel={() => {
                    setPendingPaidCobro(null);
                    setPaidFechaIngreso("");
                  }}
                  confirming={confirmingPaid}
                  formatCurrency={formatCurrency}
                />
              )}

              {pendingStatsCobro && (
                <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                  <h3 className="text-sm font-semibold text-violet-900 mb-2">
                    Marcar estadísticas enviadas — {pendingStatsCobro.clientName}
                  </h3>
                  <label className="block text-xs text-slate-700 mb-2">
                    Fecha de envío
                    <DatePickerField
                      value={statsFechaEnvio}
                      onChange={setStatsFechaEnvio}
                      className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={confirmingStats}
                      onClick={handleConfirmStatsEnviadas}
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white cursor-pointer disabled:opacity-50"
                    >
                      {confirmingStats ? "Guardando…" : "Confirmar"}
                    </button>
                    <button
                      type="button"
                      disabled={confirmingStats}
                      onClick={() => {
                        setPendingStatsCobro(null);
                        setStatsFechaEnvio("");
                      }}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Reglas del flujo */}
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm text-slate-600">
                <span className="font-medium text-slate-700">Reglas:</span> Día 0 = vence · +2/+3 = recordatorio · borde violeta al pagar · envío sugerido +5
              </div>

              {/* Tabs: Cuota única / Cuotas recurrentes / Acciones de hoy */}
              <div className="flex rounded-lg border border-slate-200 p-1 mb-4 w-fit flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setCobroFormMode("single")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    cobroFormMode === "single" ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                >
                  Cuota única
                </button>
                <button
                  type="button"
                  onClick={() => setCobroFormMode("recurrent")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                    cobroFormMode === "recurrent" ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                >
                  Cuotas recurrentes
                </button>
                <button
                  type="button"
                  onClick={() => setCobroFormMode("actions")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    cobroFormMode === "actions" ? "bg-slate-900 text-white" : "text-slate-600"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Acciones de hoy
                  {(remindersToday.length + remindersWeekBefore.length + statsToday.length + statsOverdue.length) > 0 && (
                    <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs ${cobroFormMode === "actions" ? "bg-white/20" : "bg-amber-100 text-amber-800"}`}>
                      {remindersToday.length + remindersWeekBefore.length + statsToday.length + statsOverdue.length}
                    </span>
                  )}
                </button>
              </div>

              {cobroFormMode === "actions" ? (
                /* Vista Acciones de hoy */
                <div className="space-y-6 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
                      <h3 className="text-sm font-semibold text-amber-900 mb-2">Recordatorio de pago (día +2 o +3 · −7 Florencia)</h3>
                      <p className="text-xs text-amber-800/80 mb-3">Enviar por WhatsApp a clientes con cuota pendiente</p>
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-amber-900">Mensaje guardado</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(MENSAJE_RECORDATORIO_PAGO, "recordatorio-plantilla")}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === "recordatorio-plantilla" ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-slate-800 text-xs border border-amber-200/50">
                          {MENSAJE_RECORDATORIO_PAGO}
                        </pre>
                        <p className="text-xs text-amber-700/80 mt-1">(__MONTO__ se reemplaza por el monto de cada cliente)</p>
                      </div>
                      {remindersToday.length === 0 ? (
                        <p className="text-sm text-amber-700/70">Nada para hoy</p>
                      ) : (
                        <ul className="space-y-4">
                          {remindersToday.map((c) => {
                            const mensaje = formatRecordatorioMensaje(c.amount);
                            return (
                              <li key={c.id} className="text-sm">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-medium text-slate-900">{c.clientName}</span>
                                  <span className="text-slate-600">{c.servicio || "—"}</span>
                                  <span className="text-slate-600">{formatLocalDate(c.dueDate)}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(mensaje, `recordatorio-${c.id}`)}
                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 cursor-pointer"
                                  >
                                    <Copy className="w-3 h-3" />
                                    {copiedId === `recordatorio-${c.id}` ? "Copiado" : "Copiar"}
                                  </button>
                                </div>
                                <pre className="whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-slate-800 text-xs border border-amber-200/50">
                                  {mensaje}
                                </pre>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      {remindersWeekBefore.length > 0 && (
                        <>
                          <h4 className="text-xs font-semibold text-amber-800 mt-4 mb-2">Recordatorio semana anterior (−7 Florencia)</h4>
                          <ul className="space-y-4">
                            {remindersWeekBefore.map((c) => {
                              const mensaje = formatRecordatorioMensaje(c.amount);
                              return (
                                <li key={c.id} className="text-sm">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <span className="font-medium text-slate-900">{c.clientName}</span>
                                    <span className="text-slate-600">{c.servicio || "—"}</span>
                                    <span className="text-slate-600">{formatLocalDate(c.dueDate)}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(mensaje, `recordatorio-wb-${c.id}`)}
                                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 cursor-pointer"
                                    >
                                      <Copy className="w-3 h-3" />
                                      {copiedId === `recordatorio-wb-${c.id}` ? "Copiado" : "Copiar"}
                                    </button>
                                  </div>
                                  <pre className="whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-slate-800 text-xs border border-amber-200/50">
                                    {mensaje}
                                  </pre>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                    <div className="rounded-xl border border-violet-200 bg-violet-50/50 p-4">
                      <h3 className="text-sm font-semibold text-violet-900 mb-2">Estadísticas (cobro + 5 días)</h3>
                      <p className="text-xs text-violet-800/80 mb-3">Solo clientes con &quot;Requiere estadísticas&quot; en su proyecto</p>
                      <div className="mb-3">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium text-violet-900">Mensaje guardado</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(MENSAJE_ESTADISTICAS, "estadisticas")}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-violet-200 text-violet-900 cursor-pointer"
                          >
                            <Copy className="w-3 h-3" />
                            {copiedId === "estadisticas" ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                        <pre className="whitespace-pre-wrap rounded-lg bg-white/60 p-3 text-slate-800 text-xs border border-violet-200/50">
                          {MENSAJE_ESTADISTICAS}
                        </pre>
                      </div>
                      {statsToday.length === 0 && statsOverdue.length === 0 ? (
                        <p className="text-sm text-violet-700/70">Nada pendiente</p>
                      ) : (
                        <>
                          {statsToday.length > 0 && (
                            <>
                              <h4 className="text-xs font-semibold text-violet-800 mb-2">Objetivo hoy</h4>
                              <ul className="space-y-2 mb-4">
                                {statsToday.map((c) => (
                                  <li key={c.id} className="text-sm text-slate-800 flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className="font-medium">{c.clientName}</span>
                                    <span className="text-slate-600">·</span>
                                    <span>{c.servicio || "—"}</span>
                                    <span className="text-slate-600">·</span>
                                    <span>Vence {formatLocalDate(c.dueDate)}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                          {statsOverdue.length > 0 && (
                            <>
                              <h4 className="text-xs font-semibold text-violet-900 mb-2">Atrasadas</h4>
                              <ul className="space-y-2">
                                {statsOverdue.map((c) => (
                                  <li key={c.id} className="text-sm text-slate-800 flex flex-wrap gap-x-2 gap-y-0.5">
                                    <span className="font-medium">{c.clientName}</span>
                                    <span className="text-slate-600">·</span>
                                    <span>{c.servicio || "—"}</span>
                                    <span className="text-violet-700 font-medium">· pendiente</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : cobroFormMode === "single" ? (
                <div className="mb-6">
                  <div className="mb-3">
                    <button
                      type="button"
                      onClick={() => setShowSingleCobroForm((v) => !v)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors cursor-pointer"
                    >
                      {showSingleCobroForm ? "Ocultar formulario" : "Ver formulario"}
                    </button>
                  </div>
                  {!showSingleCobroForm ? null : (
                    <form onSubmit={handleAddSingleCobro} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                        <input
                          type="text"
                          value={cobroClient}
                          onChange={(e) => setCobroClient(e.target.value)}
                          placeholder="Nombre del cliente"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Servicio</label>
                        <select
                          value={cobroServicio}
                          onChange={(e) => setCobroServicio(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                        >
                          {SERVICIO_OPTIONS.map((opt) => (
                            <option key={opt || "vacio"} value={opt}>{opt || "—"}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Origen</label>
                        <select
                          value={cobroOrigen}
                          onChange={(e) => setCobroOrigen(e.target.value as "manual" | "suscripcion_mp")}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                        >
                          <option value="manual">Manual</option>
                          <option value="suscripcion_mp">Suscripción MP</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Monto (ARS)</label>
                        <input
                          type="number"
                          min="1"
                          step="0.01"
                          value={cobroAmount}
                          onChange={(e) => setCobroAmount(e.target.value)}
                          placeholder="20000"
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha de cobro</label>
                        <DatePickerField
                          value={cobroDueDate}
                          onChange={setCobroDueDate}
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="flex items-end gap-2">
                        <ChambaToggle
                          pressed={cobroChamba}
                          onClick={() => setCobroChamba((v) => !v)}
                          disabled={cobroSubmitting}
                        />
                        <button
                          type="submit"
                          disabled={cobroSubmitting}
                          className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                            cobroSubmitting ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white"
                          }`}
                        >
                          {cobroSubmitting ? "Guardando..." : "Agregar"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                <form onSubmit={handleAddRecurrentCobros} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                    <input
                      type="text"
                      value={cobroClient}
                      onChange={(e) => setCobroClient(e.target.value)}
                      placeholder="Nombre del cliente"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Servicio</label>
                    <select
                      value={cobroServicio}
                      onChange={(e) => setCobroServicio(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                    >
                      {SERVICIO_OPTIONS.map((opt) => (
                        <option key={opt || "vacio"} value={opt}>{opt || "—"}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Origen</label>
                    <select
                      value={cobroOrigen}
                      onChange={(e) => setCobroOrigen(e.target.value as "manual" | "suscripcion_mp")}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                    >
                      <option value="manual">Manual</option>
                      <option value="suscripcion_mp">Suscripción MP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto (ARS)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={cobroAmount}
                      onChange={(e) => setCobroAmount(e.target.value)}
                      placeholder="20000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Día del mes</label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={cobroDayOfMonth}
                      onChange={(e) => setCobroDayOfMonth(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Desde mes</label>
                    <select
                      value={cobroFromMonth}
                      onChange={(e) => setCobroFromMonth(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                    >
                      {cobroMonthOptions.map((ym) => (
                        <option key={ym} value={ym}>
                          {formatMonthLabel(ym)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Cant. meses</label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={cobroMonthsToGenerate}
                      onChange={(e) => setCobroMonthsToGenerate(e.target.value)}
                      placeholder="12"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <ChambaToggle
                      pressed={cobroChamba}
                      onClick={() => setCobroChamba((v) => !v)}
                      disabled={cobroSubmitting}
                    />
                    <button
                      type="submit"
                      disabled={cobroSubmitting}
                      className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
                        cobroSubmitting ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white"
                      }`}
                    >
                      {cobroSubmitting ? "Guardando..." : "Generar cuotas"}
                    </button>
                  </div>
                </form>
              )}

              {/* Modal/panel de edición - solo en vista tabla */}
              {cobroFormMode !== "actions" && editingCobro && (
                <div className="mb-6 rounded-xl border border-[#84b9ed]/40 bg-[#84b9ed]/5 p-4">
                  <p className="text-sm font-semibold text-slate-800 mb-3">
                    Editar cuota: {editingCobro.clientName} - {formatLocalDate(editingCobro.dueDate)}
                  </p>
                  <form onSubmit={handleSaveEditCobro} className="flex flex-wrap items-end gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Monto (ARS)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={editCobroAmount}
                        onChange={(e) => setEditCobroAmount(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent w-32"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Servicio</label>
                      <select
                        value={editCobroServicio}
                        onChange={(e) => setEditCobroServicio(e.target.value)}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                      >
                        {SERVICIO_OPTIONS.map((opt) => (
                          <option key={opt || "vacio"} value={opt}>{opt || "—"}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Fecha</label>
                      <DatePickerField
                        value={editCobroDueDate}
                        onChange={setEditCobroDueDate}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editCobroUpdateFuture}
                        onChange={(e) => setEditCobroUpdateFuture(e.target.checked)}
                        className="rounded border-slate-300 text-[#84b9ed] focus:ring-[#84b9ed]"
                      />
                      <span className="text-sm text-slate-700">Actualizar cuotas futuras pendientes de este cliente</span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={cobroSubmitting}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold cursor-pointer ${
                          cobroSubmitting ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white"
                        }`}
                      >
                        {cobroSubmitting ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditCobro}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 cursor-pointer"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Filtros - ocultos en Acciones de hoy */}
              {cobroFormMode !== "actions" && (
                <>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <div className="relative w-full sm:w-64">
                      <Search
                        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden
                      />
                      <input
                        type="search"
                        value={cobroSearch}
                        onChange={(e) => setCobroSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Escape" && cobroSearch) {
                            e.stopPropagation();
                            setCobroSearch("");
                          }
                        }}
                        placeholder="Buscar cliente, servicio, monto…"
                        aria-label="Buscar cuotas del mes"
                        className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-8 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent [&::-webkit-search-cancel-button]:hidden"
                      />
                      {cobroSearch ? (
                        <button
                          type="button"
                          onClick={() => setCobroSearch("")}
                          aria-label="Limpiar búsqueda"
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 cursor-pointer"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    <label className="text-sm font-medium text-slate-700">Filtros:</label>
                    <select
                      value={cobroFilterClient}
                      onChange={(e) => setCobroFilterClient(e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent min-w-[140px] cursor-pointer"
                    >
                      <option value="">Todos los clientes</option>
                      {cobroClients.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cobroFilterPaid}
                      onChange={(e) => setCobroFilterPaid(e.target.value as "" | "paid" | "pending")}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent min-w-[120px] cursor-pointer"
                    >
                      <option value="">Todos</option>
                      <option value="paid">Pagados</option>
                      <option value="pending">Pendientes</option>
                    </select>
                    <select
                      value={cobroFilterOrigen}
                      onChange={(e) => setCobroFilterOrigen(e.target.value as "" | "manual" | "suscripcion_mp")}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent min-w-[160px] cursor-pointer"
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="manual">Manual</option>
                      <option value="suscripcion_mp">Suscripción MP</option>
                    </select>
                    {cobroFilterClient && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAllCobrosOfClient(cobroFilterClient)}
                        className="text-sm font-medium text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        Eliminar todas las cuotas de {cobroFilterClient}
                      </button>
                    )}
                  </div>
                  <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-medium">Total listado:</span>{" "}
                    <span className="font-semibold text-slate-900">{formatCurrency(totalCobrosFiltrados)}</span>
                    <span className="text-slate-500">{" "}· Mes: {formatMonthLabel(month)}</span>
                  </div>
                </>
              )}

              {/* Tabla de cuotas - oculta en Acciones de hoy */}
              {cobroFormMode !== "actions" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200">
                      <th className="text-left py-3 px-2 font-semibold text-slate-700">Cliente</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-700">Servicio</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-700">Origen</th>
                      <th className="text-left py-3 px-2 font-semibold text-slate-700">Fecha</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-700">Monto</th>
                      <th className="text-center py-3 px-2 font-semibold text-slate-700">Pagado</th>
                      <th className="text-center py-3 px-2 font-semibold text-slate-700">Recordatorio</th>
                      <th className="text-center py-3 px-2 font-semibold text-slate-700">Estadísticas</th>
                      <th className="text-right py-3 px-2 font-semibold text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cobroLoading && cobros.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredCobros.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-500">
                          {cobroSearch.trim()
                            ? `No hay cuotas que coincidan con "${cobroSearch.trim()}".`
                            : "No hay cuotas. Agregá una cuota única o generá cuotas recurrentes."}
                        </td>
                      </tr>
                    ) : (
                      filteredCobros.map((c) => {
                        const copyOpen = copyRow?.id === c.id;
                        return (
                        <Fragment key={c.id}>
                        <tr className={`bg-white ${copyOpen ? "" : "border-b border-slate-100"}`}>
                          <td className="py-3 px-2 font-medium text-slate-900">{c.clientName}</td>
                          <td className="py-3 px-2 text-slate-600">{c.servicio || "—"}</td>
                          <td className="py-3 px-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                c.origen === "suscripcion_mp" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {c.origen === "suscripcion_mp" ? "Suscripción MP" : "Manual"}
                            </span>
                          </td>
                          <td className="py-3 px-2 text-slate-600">{formatLocalDate(c.dueDate)}</td>
                          <td className="py-3 px-2 text-right font-medium text-slate-900">{formatCurrency(c.amount)}</td>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleTogglePaid(c)}
                              title={c.paid ? "Marcar como pendiente" : "Marcar como pagado"}
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-colors cursor-pointer ${
                                c.paid
                                  ? "border-green-500 bg-green-100 text-green-700"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
                              }`}
                            >
                              {c.paid ? <Check className="w-4 h-4" /> : null}
                            </button>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleRecordatorio(c)}
                              title={
                                c.recordatorioEnviado
                                  ? "Marcar recordatorio no enviado"
                                  : "Marcar recordatorio enviado"
                              }
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-colors cursor-pointer ${
                                c.recordatorioEnviado
                                  ? "border-blue-500 bg-blue-100 text-blue-700"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
                              }`}
                            >
                              {c.recordatorioEnviado ? <Check className="w-4 h-4" /> : null}
                            </button>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleEstadisticas(c)}
                              title={
                                c.estadisticasEnviadas
                                  ? `Enviadas el ${c.fechaEnvioEstadisticas ? formatLocalDate(c.fechaEnvioEstadisticas) : "—"}`
                                  : "Marcar estadísticas enviadas"
                              }
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-colors cursor-pointer ${
                                c.estadisticasEnviadas
                                  ? "border-blue-500 bg-blue-100 text-blue-700"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400"
                              }`}
                            >
                              {c.estadisticasEnviadas ? <Check className="w-4 h-4" /> : null}
                            </button>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <ChambaToggle
                                icon
                                pressed={c.chamba === true}
                                onClick={() => void handleToggleCobroChamba(c)}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setCopyRow((prev) =>
                                    prev?.id === c.id
                                      ? null
                                      : { id: c.id, month: shiftMonth(getMonthKeySafe(c.dueDate), 1) },
                                  )
                                }
                                title="Copiar a otro mes"
                                aria-label="Copiar a otro mes"
                                aria-expanded={copyOpen}
                                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                                  copyOpen ? "bg-[#84b9ed]/15 text-[#84b9ed]" : "text-slate-600 hover:text-[#84b9ed]"
                                }`}
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleEditCobro(c)}
                                title="Editar"
                                aria-label="Editar"
                                className="p-2 rounded-lg text-slate-600 hover:text-[#84b9ed] transition-colors cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCobro(c)}
                                title="Eliminar"
                                aria-label="Eliminar"
                                className="p-2 rounded-lg text-slate-600 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        {copyRow && copyOpen ? (
                          <tr className="border-b border-slate-100 bg-[#84b9ed]/5">
                            <td colSpan={9} className="px-2 pb-3 pt-1">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <span className="text-xs text-slate-600">
                                  Copiar cuota de <span className="font-medium text-slate-800">{c.clientName}</span> a:
                                </span>
                                <select
                                  value={copyRow.month}
                                  onChange={(e) => setCopyRow({ id: c.id, month: e.target.value })}
                                  aria-label="Mes destino"
                                  className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 cursor-pointer"
                                >
                                  {cobroMonthOptions
                                    .filter((ym) => ym !== getMonthKeySafe(c.dueDate))
                                    .map((ym) => (
                                      <option key={ym} value={ym}>
                                        {formatMonthLabel(ym)}
                                      </option>
                                    ))}
                                </select>
                                <button
                                  type="button"
                                  disabled={cobroSubmitting}
                                  onClick={() => void handleCopyCobroToMonth(c, copyRow.month)}
                                  className="rounded-lg bg-[#84b9ed] px-3 py-1 text-xs font-semibold text-white cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                >
                                  {cobroSubmitting ? "Pegando..." : "Pegar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setCopyRow(null)}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-slate-600 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : null}
                        </Fragment>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </div>
  );
}
