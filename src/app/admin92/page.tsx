"use client";

import { Fragment, Suspense, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Pencil, Trash2, Check, BarChart3, Calendar, FolderKanban, Copy, FileText, Briefcase, Wrench, Smile } from "lucide-react";
import { getRemindersToday, getRemindersWeekBefore, getStatsOverdue, getStatsToday } from "@/app/lib/cobrosWorkflow";
import { formatRecordatorioMensaje, MENSAJE_ESTADISTICAS, MENSAJE_RECORDATORIO_PAGO } from "@/app/lib/cobrosMensajes";
import HerramientasPanel from "@/app/admin92/contabilidad/components/HerramientasPanel";
import StackModal from "@/app/admin92/contabilidad/components/StackModal";
import CuotaNotaEditor from "@/app/admin92/contabilidad/components/CuotaNotaEditor";
import CuotaOperativaPanel from "@/app/admin92/contabilidad/components/CuotaOperativaPanel";
import Desarrollo50TasksBlock from "@/app/admin92/contabilidad/components/Desarrollo50TasksBlock";
import CambiosPendientesSidebar from "@/app/admin92/contabilidad/components/CambiosPendientesSidebar";
import ConfirmarPagoCobro from "@/app/admin92/contabilidad/components/ConfirmarPagoCobro";
import DatePickerField from "@/app/admin92/contabilidad/components/DatePickerField";
import {
  mapDesarrollo50Doc,
  sortDesarrollos50,
  getDesarrollo50AlertDate,
  type Desarrollo50Item,
} from "@/app/admin92/contabilidad/lib/desarrollos50";
import {
  buildTareasCambioDelMes,
  buildDesarrollosCambioItems,
  buildTareasCambioDesarrollos,
  getMesesConCambiosAtrasados,
  sortTareasCambioPorFecha,
  type CambiosSortMode,
} from "@/app/admin92/contabilidad/lib/cambiosPendientes";
import { buildCalendarMarkers } from "@/app/admin92/contabilidad/lib/calendarMarkers";
import {
  buildCuotaTimerRows,
  cuotaTimersFetchRange,
} from "@/app/admin92/contabilidad/lib/cuotaTimers";
import type { ErpDayLog } from "@/app/admin92/erp/lib/erpTypes";
import {
  buildProyectoByClientMap,
  getCuotaOperativaBorder,
  getProyectoForClient,
} from "@/app/admin92/contabilidad/lib/cuotaOperativa";
import {
  CUOTA_ESTADO_LABEL,
  cuotaEstadoStyles,
  getCuotaEstado,
} from "@/app/admin92/contabilidad/lib/cuotaEstilos";
import {
  formatMonthLabel,
  formatLocalDate,
  getMonthKey,
  getMonthKeySafe,
  getRecordDateStr,
  shiftDate,
  shiftMonth,
  todayYmd,
} from "@/app/admin92/contabilidad/lib/utils";

const MonthCalendar = dynamic(
  () => import("@/app/admin92/contabilidad/components/MonthCalendar"),
  {
    ssr: false,
    loading: () => (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 min-h-[320px] animate-pulse" />
    ),
  },
);

const SERVICIO_OPTIONS = ["", "App", "Tienda", "Web", "Mantenimiento", "Otro"] as const;

const WORD_ONLINE_URL =
  process.env.NEXT_PUBLIC_ENLACE_WORD?.trim() ||
  process.env.NEXT_PUBLIC_PROYECTOS_WORD_URL?.trim() ||
  "";

type WebhookEvent = {
  receivedAt: string;
  path: string;
  provider: "mp" | "resend";
  type?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: unknown;
  signatureVerified?: boolean;
  summary?: { amount?: number; currency?: string; payerEmail?: string; status?: string };
};

type AccountingType = "ingreso" | "gasto" | "inversion";

const GASTO_CATEGORIAS = ["Herramientas", "Placer"] as const;

function isGastoPlacer(category?: string): boolean {
  return (category || "").trim().toLowerCase() === "placer";
}

function isGastoHerramientas(category?: string): boolean {
  return (category || "").trim().toLowerCase() === "herramientas";
}

function gastoCategoryOptions(current: string): string[] {
  const trimmed = current.trim();
  const known = GASTO_CATEGORIAS.some((item) => item.toLowerCase() === trimmed.toLowerCase());
  if (trimmed && !known) return [trimmed, ...GASTO_CATEGORIAS];
  return [...GASTO_CATEGORIAS];
}

type AccountingRecord = {
  _id?: string;
  type: AccountingType;
  amount: number;
  description: string;
  category?: string;
  date: string;
  createdAt: string;
  chamba?: boolean;
};

/** Cuota del Cuaderno de cobros */
type Cobro = {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paid: boolean;
  paidAt?: string;
  /** Fecha real del cobro (ingreso contable) */
  fechaCobro?: string;
  servicio?: string;
  descripcionCuota?: string;
  origen?: "manual" | "suscripcion_mp";
  notes?: string;
  estadisticasEnviadas?: boolean;
  fechaEnvioEstadisticas?: string;
  recordatorioEnviado?: boolean;
  /** Si esta cuota requiere estadísticas (independiente por mes) */
  requiereEstadisticas?: boolean;
  accountingRecordId?: string;
  /** Cuota de chamba: queda fuera de los totales de negocio hasta activar el botón */
  chamba?: boolean;
  /** Prioridad manual en cola de cambios (0 = más urgente) */
  prioridad?: number;
  /** Cambio pendiente de esta cuota (ciclo mensual) */
  cambioPendiente?: boolean;
  solicitudTasks?: { id: string; text: string; done: boolean }[];
};

type ProyectoContabilidad = {
  id: string;
  name: string;
  clientName: string;
  type?: string;
  status?: string;
  fechaCobro50?: string;
  requiereEstadisticas?: boolean;
  cambioPendiente?: boolean;
  solicitudTasks?: { id: string; text: string; done: boolean }[];
  ultimaSolicitud?: string;
};

const typeLabels: Record<AccountingType, string> = {
  ingreso: "Ingreso",
  gasto: "Gasto",
  inversion: "Inversión",
};

const typeColors: Record<AccountingType, string> = {
  ingreso: "bg-green-100 text-green-800",
  gasto: "bg-red-100 text-red-800",
  inversion: "bg-blue-100 text-blue-800",
};

type SubscriptionAdmin = {
  preapprovalId: string;
  email: string;
  name?: string;
  plan: string;
  status: string;
  createdAt?: string;
  ga4PropertyId: string | null;
};

function ChambaToggle({
  pressed,
  onClick,
  disabled,
  icon = false,
}: {
  pressed: boolean;
  onClick: () => void;
  disabled?: boolean;
  icon?: boolean;
}) {
  const label = pressed ? "Quitar chamba" : "Marcar como chamba";
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={icon ? label : undefined}
      title={icon ? label : undefined}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg border cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${
        icon ? "p-2" : "px-2.5 py-1 text-xs font-semibold"
      } ${
        pressed
          ? "border-[#9a3412] bg-[#c2410c] text-white"
          : "border-slate-300 bg-white text-slate-700"
      }`}
    >
      {icon ? <Briefcase className="h-4 w-4" /> : "Chamba"}
    </button>
  );
}

function Admin92PageContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isContabilidadPwa = pathname?.startsWith("/admin92/contabilidad") ?? false;

  const [activeTab, setActiveTab] = useState<"webhooks" | "contabilidad" | "suscripciones">("contabilidad");

  // Ruta dedicada /admin92/contabilidad (PWA) → siempre contabilidad. Si no, `?tab=` en /admin92.
  useEffect(() => {
    if (isContabilidadPwa) {
      setActiveTab("contabilidad");
      return;
    }
    const tab = searchParams.get("tab");
    if (tab === "webhooks" || tab === "contabilidad" || tab === "suscripciones") {
      setActiveTab(tab);
    }
  }, [searchParams, isContabilidadPwa]);

  // Webhooks state
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [webhookProviderFilter, setWebhookProviderFilter] = useState<"all" | "mp" | "resend">("all");
  const [webhookTypeFilter, setWebhookTypeFilter] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"mongo" | "memory" | "unknown">("unknown");

  // Contabilidad state
  const [records, setRecords] = useState<AccountingRecord[]>([]);
  const [accLoading, setAccLoading] = useState(false);
  const [accError, setAccError] = useState<string>("");
  const [formType, setFormType] = useState<AccountingType>("ingreso");
  const [formAmount, setFormAmount] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDate, setFormDate] = useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AccountingRecord | null>(null);
  const [showNewRecordForm, setShowNewRecordForm] = useState(false);
  const [contabilidadMonth, setContabilidadMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  /** Cuota enfocada desde el panel de cambios (scroll + resaltado) */
  const [focusedCobroId, setFocusedCobroId] = useState<string | null>(null);
  const [focusedDesarrolloId, setFocusedDesarrolloId] = useState<string | null>(null);
  const [cambiosSortMode, setCambiosSortMode] = useState<CambiosSortMode>("tareas");
  const [contabilidadToolPanel, setContabilidadToolPanel] = useState<
    null | "objetivos" | "mantenimientos" | "buscar-clientes"
  >(null);
  const [stackOpen, setStackOpen] = useState(false);
  const [pendingPaidCobro, setPendingPaidCobro] = useState<Cobro | null>(null);
  const [paidFechaIngreso, setPaidFechaIngreso] = useState("");
  const [confirmingPaid, setConfirmingPaid] = useState(false);
  const confirmPagoRef = useRef<HTMLDivElement>(null);

  // Cuaderno de cobros
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [cobroLoading, setCobroLoading] = useState(false);
  const [cobroError, setCobroError] = useState("");
  const [desarrollos50, setDesarrollos50] = useState<Desarrollo50Item[]>([]);
  const [desarrollosRefreshKey, setDesarrollosRefreshKey] = useState(0);
  const [cuotaTimersOpen, setCuotaTimersOpen] = useState(false);
  const [cuotaTimerLogs, setCuotaTimerLogs] = useState<ErpDayLog[]>([]);
  const [cuotaTimersLoading, setCuotaTimersLoading] = useState(false);
  const [cuotaTimersError, setCuotaTimersError] = useState("");
  const [cuotaTimersNow, setCuotaTimersNow] = useState(() => Date.now());
  const [cobroSubmitting, setCobroSubmitting] = useState(false);
  const [cobroFormMode, setCobroFormMode] = useState<"single" | "recurrent" | "actions">("single");
  const [showSingleCobroForm, setShowSingleCobroForm] = useState(false);
  const [cobroClient, setCobroClient] = useState("");
  const [cobroAmount, setCobroAmount] = useState("");
  const [cobroServicio, setCobroServicio] = useState("");
  const [cobroOrigen, setCobroOrigen] = useState<"manual" | "suscripcion_mp">("manual");
  const [cobroDueDate, setCobroDueDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [cobroDayOfMonth, setCobroDayOfMonth] = useState("1");
  const [cobroFromMonth, setCobroFromMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [cobroMonthsToGenerate, setCobroMonthsToGenerate] = useState("12");
  const [copyRow, setCopyRow] = useState<{ id: string; month: string } | null>(null);
  const [cobroChamba, setCobroChamba] = useState(false);
  const [includeChamba, setIncludeChamba] = useState(false);
  const [editingCobro, setEditingCobro] = useState<Cobro | null>(null);
  const [editCobroAmount, setEditCobroAmount] = useState("");
  const [editCobroServicio, setEditCobroServicio] = useState("");
  const [editCobroDueDate, setEditCobroDueDate] = useState("");
  const [editCobroUpdateFuture, setEditCobroUpdateFuture] = useState(false);
  const [cobroFilterClient, setCobroFilterClient] = useState("");
  const [cobroFilterPaid, setCobroFilterPaid] = useState<"" | "paid" | "pending">("");
  const [cobroFilterOrigen, setCobroFilterOrigen] = useState<"" | "manual" | "suscripcion_mp">("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingStatsCobro, setPendingStatsCobro] = useState<Cobro | null>(null);
  const [statsFechaEnvio, setStatsFechaEnvio] = useState("");
  const [confirmingStats, setConfirmingStats] = useState(false);

  // Proyectos (vinculados a cuotas por clientName)
  const [proyectos, setProyectos] = useState<ProyectoContabilidad[]>([]);

  // Suscripciones (GA4 Property ID)
  const [subscriptions, setSubscriptions] = useState<SubscriptionAdmin[]>([]);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState("");
  const [editingSub, setEditingSub] = useState<SubscriptionAdmin | null>(null);
  const [editGa4PropertyId, setEditGa4PropertyId] = useState("");
  const [subSaving, setSubSaving] = useState(false);
  const [subStatusFilter, setSubStatusFilter] = useState<"all" | "pending" | "authorized" | "other">("all");

  const fetchSubscriptions = async () => {
    setSubLoading(true);
    setSubError("");
    try {
      const res = await fetch("/api/admin/subscriptions", { method: "GET" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar");
      setSubscriptions(data.subscriptions ?? []);
    } catch (e: any) {
      setSubError(e?.message || "Error al cargar suscripciones");
    } finally {
      setSubLoading(false);
    }
  };

  const handleSaveGa4PropertyId = async () => {
    if (!editingSub) return;
    setSubSaving(true);
    try {
      const res = await fetch(`/api/admin/subscriptions/${encodeURIComponent(editingSub.preapprovalId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ga4PropertyId: editGa4PropertyId.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar");
      setSubscriptions((prev) =>
        prev.map((s) =>
          s.preapprovalId === editingSub.preapprovalId
            ? { ...s, ga4PropertyId: editGa4PropertyId.trim() || null }
            : s
        )
      );
      setEditingSub(null);
    } catch (e: any) {
      setSubError(e?.message || "Error al guardar");
    } finally {
      setSubSaving(false);
    }
  };

  const filteredSubscriptions = useMemo(() => {
    if (subStatusFilter === "all") return subscriptions;
    if (subStatusFilter === "pending") return subscriptions.filter((s) => s.status === "pending");
    if (subStatusFilter === "authorized") return subscriptions.filter((s) => s.status === "authorized");
    return subscriptions.filter((s) => s.status !== "pending" && s.status !== "authorized");
  }, [subscriptions, subStatusFilter]);

  const pendingSubscriptionsCount = useMemo(
    () => subscriptions.filter((s) => s.status === "pending").length,
    [subscriptions],
  );

  const fetchEvents = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (webhookProviderFilter !== "all") params.set("provider", webhookProviderFilter);
      const res = await fetch(`/api/admin/webhooks?${params.toString()}`, { method: "GET" });
      const raw = await res.text();
      let data: any = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = { raw };
      }
      if (!res.ok) {
        setError(data?.error || "No se pudo cargar el panel.");
        return;
      }
      setEvents(Array.isArray(data?.events) ? data.events : []);
      setSource(data?.source === "mongo" || data?.source === "memory" ? data.source : "unknown");
    } catch (e: any) {
      setError(e?.message || "Error de red.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    setAccLoading(true);
    setAccError("");
    try {
      const res = await fetch("/api/admin/accounting", { method: "GET" });
      const data = await res.json();
      if (!res.ok) {
        setAccError(data?.error || "No se pudieron cargar los registros.");
        return;
      }
      setRecords(Array.isArray(data?.records) ? data.records : []);
    } catch (e: any) {
      setAccError(e?.message || "Error de red.");
    } finally {
      setAccLoading(false);
    }
  };

  const fetchCobros = async () => {
    setCobroLoading(true);
    setCobroError("");
    try {
      const res = await fetch("/api/admin/cobros", { method: "GET" });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudieron cargar los cobros.");
        return;
      }
      const list = Array.isArray(data?.cobros) ? data.cobros : [];
      setCobros(
        list.map((c: Cobro & { _id?: string }) => ({
          ...c,
          id: c.id || c._id || "",
          origen: c.origen === "suscripcion_mp" ? "suscripcion_mp" : "manual",
          accountingRecordId: c.accountingRecordId,
          fechaCobro: c.fechaCobro,
          fechaEnvioEstadisticas: c.fechaEnvioEstadisticas,
          prioridad: c.prioridad,
          cambioPendiente: c.cambioPendiente,
          solicitudTasks: c.solicitudTasks,
        })),
      );
    } catch (e: any) {
      setCobroError(e?.message || "Error de red.");
    } finally {
      setCobroLoading(false);
    }
  };

  const fetchDesarrollos50 = async () => {
    try {
      const res = await fetch("/api/admin/desarrollos-50");
      const data = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(data.desarrollos)
        ? sortDesarrollos50(data.desarrollos.map(mapDesarrollo50Doc))
        : [];
      setDesarrollos50(list);
      setDesarrollosRefreshKey((k) => k + 1);
    } catch {
      /* silencioso */
    }
  };

  const fetchProyectos = async () => {
    try {
      const res = await fetch("/api/admin/proyectos", { method: "GET" });
      const data = await res.json();
      if (!res.ok) return;
      const list = Array.isArray(data?.proyectos) ? data.proyectos : [];
      setProyectos(
        list.map((p: ProyectoContabilidad & { _id?: string }) => ({
          id: p.id || p._id || "",
          name: p.name,
          clientName: p.clientName,
          type: p.type,
          status: p.status,
          fechaCobro50: p.fechaCobro50,
          requiereEstadisticas: p.requiereEstadisticas,
          cambioPendiente: p.cambioPendiente,
          solicitudTasks: p.solicitudTasks,
          ultimaSolicitud: p.ultimaSolicitud,
        })),
      );
    } catch {
      /* silencioso */
    }
  };

  useEffect(() => {
    if (activeTab === "contabilidad") {
      fetchRecords();
      fetchCobros();
      fetchDesarrollos50();
      fetchProyectos();
    }
  }, [activeTab]);

  /** Flechas del teclado cambian el día seleccionado (← → ±1 día, ↑ ↓ ±1 semana) */
  useEffect(() => {
    if (activeTab !== "contabilidad") return;

    const onKeyDown = (e: KeyboardEvent) => {
      const dayDelta =
        e.key === "ArrowLeft"
          ? -1
          : e.key === "ArrowRight"
            ? 1
            : e.key === "ArrowUp"
              ? -7
              : e.key === "ArrowDown"
                ? 7
                : null;
      if (dayDelta === null) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      e.preventDefault();
      const base =
        selectedDate ??
        (getMonthKeySafe(todayYmd()) === contabilidadMonth ? todayYmd() : `${contabilidadMonth}-01`);
      const next = shiftDate(base, dayDelta);
      const nextMonth = getMonthKeySafe(next);
      if (nextMonth !== contabilidadMonth) {
        setContabilidadMonth(nextMonth);
      }
      setSelectedDate(next);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTab, contabilidadMonth, selectedDate]);

  useEffect(() => {
    if (activeTab === "webhooks") fetchEvents();
    if (activeTab === "suscripciones") fetchSubscriptions();
  }, [activeTab, webhookProviderFilter]);

  const handleSubmitRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(formAmount);
    if (isNaN(amount) || amount <= 0) {
      setAccError("El monto debe ser un número positivo.");
      return;
    }
    if (!formDescription.trim()) {
      setAccError("La descripción es requerida.");
      return;
    }
    if (formType === "gasto" && !formCategory.trim()) {
      setAccError("Elegí Herramientas o Placer.");
      return;
    }
    setSubmitting(true);
    setAccError("");
    try {
      if (editingRecord?._id) {
        const res = await fetch(`/api/admin/accounting/${editingRecord._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: formType,
            amount,
            description: formDescription.trim(),
            category: formCategory.trim() || undefined,
            date: formDate || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAccError(data?.error || "No se pudo actualizar.");
          return;
        }
        setEditingRecord(null);
      } else {
        const res = await fetch("/api/admin/accounting", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: formType,
            amount,
            description: formDescription.trim(),
            category: formCategory.trim() || undefined,
            date: formDate || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setAccError(data?.error || "No se pudo guardar.");
          return;
        }
      }
      setFormAmount("");
      setFormDescription("");
      setFormCategory("");
      setFormDate(new Date().toISOString().slice(0, 10));
      fetchRecords();
    } catch (e: any) {
      setAccError(e?.message || "Error al guardar.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (r: AccountingRecord) => {
    setEditingRecord(r);
    setFormType(r.type);
    setFormAmount(String(r.amount));
    setFormDescription(r.description);
    setFormCategory(r.category || "");
    setFormDate(
      typeof r.date === "string" && r.date.length >= 10
        ? r.date.slice(0, 10)
        : new Date(r.date).toISOString().slice(0, 10)
    );
  };

  const handleCancelEdit = () => {
    setEditingRecord(null);
    setFormType("ingreso");
    setFormAmount("");
    setFormDescription("");
    setFormCategory("");
    setFormDate(new Date().toISOString().slice(0, 10));
  };

  const handleDelete = async (r: AccountingRecord) => {
    if (!r._id) return;
    if (!window.confirm(`¿Eliminar este registro?\n${r.description} - ${r.amount} ARS`)) return;
    try {
      const res = await fetch(`/api/admin/accounting/${r._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setAccError(data?.error || "No se pudo eliminar.");
        return;
      }
      fetchRecords();
    } catch (e: any) {
      setAccError(e?.message || "Error al eliminar.");
    }
  };

  const filteredRecords = useMemo(() => {
    return records.filter((r) => getMonthKey(r.date) === contabilidadMonth);
  }, [records, contabilidadMonth]);

  const cobrosEnMes = useMemo(
    () => cobros.filter((c) => getMonthKeySafe(c.dueDate) === contabilidadMonth),
    [cobros, contabilidadMonth],
  );

  const cuotaTimerRange = useMemo(
    () => cuotaTimersFetchRange(cobrosEnMes.map((c) => c.dueDate)),
    [cobrosEnMes],
  );

  useEffect(() => {
    if (!cuotaTimersOpen || !cuotaTimerRange) {
      setCuotaTimerLogs([]);
      setCuotaTimersError("");
      setCuotaTimersLoading(false);
      return;
    }
    const controller = new AbortController();
    setCuotaTimersLoading(true);
    setCuotaTimersError("");
    void fetch(`/api/admin/erp-logs?from=${cuotaTimerRange.from}&to=${cuotaTimerRange.to}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const data = (await response.json()) as { logs?: ErpDayLog[]; error?: string };
        if (!response.ok) {
          throw new Error(data.error || "No se pudieron cargar las horas.");
        }
        setCuotaTimerLogs(data.logs ?? []);
        setCuotaTimersNow(Date.now());
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setCuotaTimerLogs([]);
        setCuotaTimersError(
          error instanceof Error ? error.message : "No se pudieron cargar las horas.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCuotaTimersLoading(false);
      });
    return () => controller.abort();
  }, [cuotaTimersOpen, cuotaTimerRange]);

  const cuotaTimerRows = useMemo(() => {
    if (!cuotaTimersOpen) return [];
    return buildCuotaTimerRows(
      cobrosEnMes.map((c) => ({ id: c.id, clientName: c.clientName, dueDate: c.dueDate })),
      cuotaTimerLogs,
      cuotaTimersNow,
      todayYmd(),
    );
  }, [cobrosEnMes, cuotaTimerLogs, cuotaTimersNow, cuotaTimersOpen]);

  const proyectoByClient = useMemo(
    () => buildProyectoByClientMap(proyectos),
    [proyectos],
  );

  const requiereStatsByClient = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const p of proyectoByClient.values()) {
      map.set(p.clientName.trim().toLowerCase(), Boolean(p.requiereEstadisticas));
    }
    return map;
  }, [proyectoByClient]);

  const cuotasConCambioPendiente = useMemo(() => {
    const today = todayYmd();
    const fromCobros = cobrosEnMes
      .filter((c) => Boolean(c.cambioPendiente))
      .map((c) => {
        const p = getProyectoForClient(c.clientName, proyectoByClient);
        return {
          id: c.id,
          clientName: c.clientName,
          dueDate: c.dueDate,
          servicio: c.servicio,
          prioridad: c.prioridad,
          estado: getCuotaEstado(c),
          border: getCuotaOperativaBorder(c, p, today),
          source: "cobro" as const,
        };
      });
    const fromDesarrollos = buildDesarrollosCambioItems(desarrollos50, today);
    return [...fromCobros, ...fromDesarrollos];
  }, [cobrosEnMes, proyectoByClient, desarrollos50]);

  const tareasCambioMes = useMemo(() => {
    const today = todayYmd();
    const fromCobros = buildTareasCambioDelMes(cobrosEnMes, (c) => {
      const p = getProyectoForClient(c.clientName, proyectoByClient);
      return {
        estado: getCuotaEstado(c),
        border: getCuotaOperativaBorder(c, p, today),
      };
    });
    const fromDesarrollos = buildTareasCambioDesarrollos(desarrollos50, today);
    return sortTareasCambioPorFecha([...fromCobros, ...fromDesarrollos]);
  }, [cobrosEnMes, proyectoByClient, desarrollos50]);

  const mesesConCambiosAtrasados = useMemo(
    () => getMesesConCambiosAtrasados(cobros, contabilidadMonth),
    [cobros, contabilidadMonth],
  );

  const calendarMarkers = useMemo(
    () => buildCalendarMarkers(filteredRecords, cobrosEnMes, proyectos, todayYmd()),
    [filteredRecords, cobrosEnMes, proyectos],
  );

  const dayRecords = useMemo(() => {
    if (selectedDate) {
      return filteredRecords.filter((r) => getRecordDateStr(r.date) === selectedDate);
    }
    return filteredRecords;
  }, [filteredRecords, selectedDate]);

  const dayCuotas = useMemo(() => {
    // Cuotas del mes no se listan en "Registros de …"; solo al elegir un día en el calendario.
    if (!selectedDate) return [];
    const list = cobros.filter((c) => c.dueDate === selectedDate);
    const order: Record<ReturnType<typeof getCuotaEstado>, number> = {
      pendiente: 0,
      recordada: 1,
      pagada: 2,
    };
    return [...list].sort((a, b) => {
      const diff = order[getCuotaEstado(a)] - order[getCuotaEstado(b)];
      if (diff !== 0) return diff;
      return a.clientName.localeCompare(b.clientName);
    });
  }, [cobros, selectedDate]);

  const dayDesarrollos50 = useMemo(() => {
    if (!selectedDate) return [];
    const today = todayYmd();
    return desarrollos50.filter((d) => {
      if (d.fechaCobro50 === selectedDate) return true;
      if (!d.cambioPendiente) return false;
      return getDesarrollo50AlertDate(d, today) === selectedDate;
    });
  }, [desarrollos50, selectedDate]);

  const cuotaEsperadaLabel = (c: Cobro) =>
    c.servicio ? `${c.clientName} (${c.servicio}) - Cuota` : `${c.clientName} - Cuota`;

  const cuotaClienteLabel = (c: Cobro) => `${c.clientName} - Cuota`;

  const getCuotaDescripcion = (c: Cobro) =>
    c.descripcionCuota?.trim() || cuotaClienteLabel(c);

  const cuotaFechaCobroYmd = (c: Cobro) => {
    if (!c.paid) return "";
    const fecha = c.fechaCobro || c.paidAt;
    return fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : todayYmd();
  };

  const recordsById = useMemo(
    () => new Map(records.filter((r) => r._id).map((r) => [r._id!, r])),
    [records],
  );

  const cobranzaKpis = useMemo(() => {
    const inMonth = cobros.filter(
      (c) => getMonthKeySafe(c.dueDate) === contabilidadMonth && (includeChamba || c.chamba !== true),
    );
    const esperado = inMonth.reduce((sum, c) => sum + c.amount, 0);
    const pendiente = inMonth.filter((c) => !c.paid).reduce((sum, c) => sum + c.amount, 0);
    const cobrado = cobros
      .filter((c) => {
        if (!includeChamba && c.chamba === true) return false;
        if (!c.paid) return false;
        if (c.accountingRecordId) {
          const rec = recordsById.get(c.accountingRecordId);
          if (rec) return getMonthKey(rec.date) === contabilidadMonth;
        }
        const fechaContable = c.fechaCobro || c.dueDate;
        return getMonthKeySafe(fechaContable) === contabilidadMonth;
      })
      .reduce((sum, c) => sum + c.amount, 0);
    return { esperado, cobrado, pendiente };
  }, [cobros, contabilidadMonth, recordsById, includeChamba]);

  /** Ganado vs restante del mes, según fecha contable de cobros y corte (hoy o día seleccionado). */
  const cobranzaProgreso = useMemo(() => {
    const inMonth = cobros.filter(
      (c) => getMonthKeySafe(c.dueDate) === contabilidadMonth && (includeChamba || c.chamba !== true),
    );
    const esperadoTotal = inMonth.reduce((sum, c) => sum + c.amount, 0);
    const hoy = todayYmd();
    const mesActual = getMonthKey(hoy);

    let asOfDate = hoy;
    if (selectedDate && getMonthKeySafe(selectedDate) === contabilidadMonth) {
      asOfDate = selectedDate;
    } else if (contabilidadMonth < mesActual) {
      const [y, m] = contabilidadMonth.split("-").map(Number);
      asOfDate = `${y}-${String(m).padStart(2, "0")}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    } else if (contabilidadMonth > mesActual) {
      return { esperadoTotal, ganadoHasta: 0, esperadoRestante: esperadoTotal, asOfDate: null as string | null };
    }

    const ganadoHasta = cobros
      .filter((c) => {
        if (!includeChamba && c.chamba === true) return false;
        if (!c.paid) return false;
        let fechaContable: string;
        if (c.accountingRecordId) {
          const rec = recordsById.get(c.accountingRecordId);
          if (!rec) return false;
          fechaContable = getRecordDateStr(rec.date);
        } else {
          fechaContable = c.fechaCobro || c.dueDate;
        }
        if (getMonthKeySafe(fechaContable) !== contabilidadMonth) return false;
        return fechaContable <= asOfDate;
      })
      .reduce((sum, c) => sum + c.amount, 0);

    const esperadoRestante = Math.max(0, esperadoTotal - ganadoHasta);
    return { esperadoTotal, ganadoHasta, esperadoRestante, asOfDate };
  }, [cobros, contabilidadMonth, recordsById, selectedDate, includeChamba]);

  // Meses para formulario de cuotas recurrentes (desde hace 12 meses hasta +24)
  const cobroMonthOptions = useMemo(() => {
    const now = new Date();
    const options: string[] = [];
    for (let i = -12; i <= 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      options.push(getMonthKey(d));
    }
    return options;
  }, []);

  const cobroClients = useMemo(() => {
    const names = new Set(cobros.map((c) => c.clientName));
    return Array.from(names).sort();
  }, [cobros]);

  const filteredCobros = useMemo(() => {
    let list = [...cobros];
    if (cobroFilterClient) {
      list = list.filter((c) => c.clientName === cobroFilterClient);
    }
    list = list.filter((c) => getMonthKeySafe(c.dueDate) === contabilidadMonth);
    if (cobroFilterPaid === "paid") list = list.filter((c) => c.paid);
    if (cobroFilterPaid === "pending") list = list.filter((c) => !c.paid);
    if (cobroFilterOrigen) list = list.filter((c) => c.origen === cobroFilterOrigen);
    return list.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [cobros, cobroFilterClient, contabilidadMonth, cobroFilterPaid, cobroFilterOrigen]);

  const totalCobrosFiltrados = useMemo(
    () => filteredCobros.reduce((sum, c) => sum + c.amount, 0),
    [filteredCobros],
  );

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const remindersToday = useMemo(
    () => getRemindersToday(cobros),
    [cobros]
  );
  const remindersWeekBefore = useMemo(
    () => getRemindersWeekBefore(cobros),
    [cobros]
  );
  const statsToday = useMemo(
    () => getStatsToday(cobros, undefined, requiereStatsByClient),
    [cobros, requiereStatsByClient],
  );
  const statsOverdue = useMemo(
    () => getStatsOverdue(cobros, undefined, requiereStatsByClient),
    [cobros, requiereStatsByClient],
  );

  const handleAddSingleCobro = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cobroAmount);
    if (!cobroClient.trim() || isNaN(amount) || amount <= 0) return;
    setCobroSubmitting(true);
    setCobroError("");
    try {
      const res = await fetch("/api/admin/cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: cobroClient.trim(),
          amount,
          dueDate: cobroDueDate,
          servicio: cobroServicio || undefined,
          origen: cobroOrigen,
          paid: false,
          ...(cobroChamba ? { chamba: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo guardar.");
        return;
      }
      const d = new Date();
      setCobroClient("");
      setCobroAmount("");
      setCobroServicio("");
      setCobroOrigen("manual");
      setCobroChamba(false);
      setCobroDueDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al guardar.");
    } finally {
      setCobroSubmitting(false);
    }
  };

  const handleAddRecurrentCobros = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(cobroAmount);
    const day = Math.min(31, Math.max(1, parseInt(cobroDayOfMonth, 10) || 1));
    const months = Math.min(60, Math.max(1, parseInt(cobroMonthsToGenerate, 10) || 12));
    if (!cobroClient.trim() || isNaN(amount) || amount <= 0) return;
    const [y, m] = cobroFromMonth.split("-").map(Number);
    const toInsert: {
      clientName: string;
      amount: number;
      dueDate: string;
      servicio?: string;
      origen: "manual" | "suscripcion_mp";
      chamba?: boolean;
    }[] = [];
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
    setCobroSubmitting(true);
    setCobroError("");
    try {
      const res = await fetch("/api/admin/cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cobros: toInsert }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudieron guardar las cuotas.");
        return;
      }
      setCobroClient("");
      setCobroAmount("");
      setCobroServicio("");
      setCobroOrigen("manual");
      setCobroChamba(false);
      setCobroDayOfMonth("1");
      const now = new Date();
      setCobroFromMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
      setCobroMonthsToGenerate("12");
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al guardar.");
    } finally {
      setCobroSubmitting(false);
    }
  };

  const dueDateInMonth = (dueDate: string, targetYm: string) => {
    const day = Number(dueDate.slice(8, 10));
    const [y, m] = targetYm.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${targetYm}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };

  const handleCopyCobroToMonth = async (c: Cobro, targetYm: string) => {
    const dueDate = dueDateInMonth(c.dueDate, targetYm);
    if (cobros.some((row) => row.clientName === c.clientName && row.dueDate === dueDate)) {
      setCobroError("Esa cuota ya existe en ese mes.");
      return;
    }
    setCobroSubmitting(true);
    setCobroError("");
    try {
      const res = await fetch("/api/admin/cobros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo copiar la cuota.");
        return;
      }
      setCopyRow(null);
      fetchCobros();
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al copiar.");
    } finally {
      setCobroSubmitting(false);
    }
  };

  const handleToggleCobroChamba = async (c: Cobro) => {
    const next = c.chamba !== true;
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chamba: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo marcar la cuota.");
        return;
      }
      fetchCobros();
      if (c.accountingRecordId) fetchRecords();
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al marcar la cuota.");
    }
  };

  const handleToggleRecordChamba = async (r: AccountingRecord) => {
    if (r.type !== "ingreso" || !r._id) return;
    const next = r.chamba !== true;
    setAccError("");
    try {
      const res = await fetch(`/api/admin/accounting/${r._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chamba: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAccError(data?.error || "No se pudo marcar el ingreso.");
        return;
      }
      fetchRecords();
      fetchCobros();
    } catch (e: unknown) {
      setAccError(e instanceof Error ? e.message : "Error al marcar el ingreso.");
    }
  };

  const handleTogglePaid = async (c: Cobro) => {
    if (c.paid) {
      try {
        const res = await fetch(`/api/admin/cobros/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paid: false }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCobroError(data?.error || "No se pudo actualizar.");
          return;
        }
        fetchCobros();
      } catch (e: any) {
        setCobroError(e?.message || "Error al actualizar.");
      }
      return;
    }
    setPendingPaidCobro(c);
    setPaidFechaIngreso(todayYmd());
  };

  const handleConfirmMarkPaid = async () => {
    if (!pendingPaidCobro) return;
    setConfirmingPaid(true);
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${pendingPaidCobro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid: true, fechaIngreso: paidFechaIngreso }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar.");
        return;
      }
      setPendingPaidCobro(null);
      setPaidFechaIngreso("");
      fetchCobros();
      fetchRecords();
    } catch (e: any) {
      setCobroError(e?.message || "Error al actualizar.");
    } finally {
      setConfirmingPaid(false);
    }
  };

  const handleFechaCobroChange = async (c: Cobro, fecha: string) => {
    if (!c.paid || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
    if (cuotaFechaCobroYmd(c) === fecha) return;
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fechaIngreso: fecha }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar la fecha de cobro.");
        return;
      }
      fetchCobros();
      fetchRecords();
    } catch (e: any) {
      setCobroError(e?.message || "Error al actualizar la fecha de cobro.");
    }
  };

  const handleDescripcionCuotaChange = async (c: Cobro, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (getCuotaDescripcion(c) === trimmed) return;
    const defaultLabel = cuotaClienteLabel(c);
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcionCuota: trimmed === defaultLabel ? "" : trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar la descripción.");
        return;
      }
      fetchCobros();
      fetchRecords();
    } catch (e: any) {
      setCobroError(e?.message || "Error al actualizar la descripción.");
    }
  };

  useEffect(() => {
    if (pendingPaidCobro && confirmPagoRef.current) {
      confirmPagoRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [pendingPaidCobro]);

  const handleToggleEstadisticas = async (c: Cobro) => {
    if (c.estadisticasEnviadas) {
      try {
        const res = await fetch(`/api/admin/cobros/${c.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estadisticasEnviadas: false }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCobroError(data?.error || "No se pudo actualizar.");
          return;
        }
        fetchCobros();
      } catch (e: any) {
        setCobroError(e?.message || "Error al actualizar.");
      }
      return;
    }
    setPendingStatsCobro(c);
    setStatsFechaEnvio(todayYmd());
  };

  const handleConfirmStatsEnviadas = async () => {
    if (!pendingStatsCobro) return;
    setConfirmingStats(true);
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${pendingStatsCobro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          estadisticasEnviadas: true,
          fechaEnvioEstadisticas: statsFechaEnvio,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar.");
        return;
      }
      setPendingStatsCobro(null);
      setStatsFechaEnvio("");
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al actualizar.");
    } finally {
      setConfirmingStats(false);
    }
  };

  const handleSelectCuotaFromSidebar = (c: {
    id: string;
    dueDate: string;
    source?: "cobro" | "desarrollo50";
  }) => {
    if (c.source === "desarrollo50") {
      const alertDate = /^\d{4}-\d{2}-\d{2}$/.test(c.dueDate) ? c.dueDate : todayYmd();
      setContabilidadMonth(getMonthKeySafe(alertDate));
      setSelectedDate(alertDate);
      setFocusedDesarrolloId(c.id);
      setFocusedCobroId(null);
      return;
    }
    setSelectedDate(c.dueDate);
    setFocusedCobroId(c.id);
    setFocusedDesarrolloId(null);
  };

  const handleGoToMesCambiosAtrasados = (monthKey: string) => {
    setContabilidadMonth(monthKey);
    setSelectedDate(null);
    setFocusedCobroId(null);
    setFocusedDesarrolloId(null);
  };

  const handleDismissTaskFromColaActiva = async (cobroId: string, taskId: string) => {
    const desarrollo = desarrollos50.find((d) => d.id === cobroId);
    if (desarrollo) {
      const nextTasks = (desarrollo.solicitudTasks ?? []).map((t) =>
        t.id === taskId ? { ...t, fueraColaActiva: true } : t,
      );
      setDesarrollos50((prev) =>
        prev.map((d) => (d.id === cobroId ? { ...d, solicitudTasks: nextTasks } : d)),
      );
      try {
        const res = await fetch(`/api/admin/desarrollos-50/${cobroId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ solicitudTasks: nextTasks }),
        });
        const data = await res.json();
        if (!res.ok) {
          setCobroError(data?.error || "No se pudo quitar la tarea de la cola activa.");
          void fetchDesarrollos50();
        } else {
          setDesarrollosRefreshKey((k) => k + 1);
        }
      } catch (e: unknown) {
        setCobroError(e instanceof Error ? e.message : "Error al actualizar.");
        void fetchDesarrollos50();
      }
      return;
    }

    const cobro = cobros.find((c) => c.id === cobroId);
    if (!cobro) return;
    const nextTasks = (cobro.solicitudTasks ?? []).map((t) =>
      t.id === taskId ? { ...t, fueraColaActiva: true } : t,
    );
    setCobros((prev) =>
      prev.map((c) => (c.id === cobroId ? { ...c, solicitudTasks: nextTasks } : c)),
    );
    try {
      const res = await fetch(`/api/admin/cobros/${cobroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ solicitudTasks: nextTasks }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo quitar la tarea de la cola activa.");
        fetchCobros();
      }
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al actualizar.");
      fetchCobros();
    }
  };

  const handleCobroPrioridadChange = async (cobroId: string, prioridad: number | undefined) => {
    setCobros((prev) =>
      prev.map((c) => {
        if (c.id !== cobroId) return c;
        const next = { ...c };
        if (prioridad === undefined) delete next.prioridad;
        else next.prioridad = prioridad;
        return next;
      }),
    );
    try {
      const res = await fetch(`/api/admin/cobros/${cobroId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prioridad: prioridad ?? null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar la prioridad.");
        fetchCobros();
        return;
      }
    } catch (e: unknown) {
      setCobroError(e instanceof Error ? e.message : "Error al actualizar.");
      fetchCobros();
    }
  };

  useEffect(() => {
    if (!focusedCobroId || !selectedDate) return;
    const t = window.setTimeout(() => {
      document.getElementById(`cuota-row-${focusedCobroId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusedCobroId, selectedDate, dayCuotas]);

  useEffect(() => {
    if (!focusedDesarrolloId || !selectedDate) return;
    const t = window.setTimeout(() => {
      document.getElementById(`desarrollo-row-${focusedDesarrolloId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }, 80);
    return () => window.clearTimeout(t);
  }, [focusedDesarrolloId, selectedDate, dayDesarrollos50]);

  useEffect(() => {
    if (!focusedCobroId && !focusedDesarrolloId) return;
    const onPointerDown = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el) return;
      if (el.closest("[data-cambios-sidebar]")) return;
      if (focusedCobroId && el.closest(`[data-cuota-block="${focusedCobroId}"]`)) return;
      if (focusedDesarrolloId && el.closest(`[data-desarrollo-block="${focusedDesarrolloId}"]`))
        return;
      setFocusedCobroId(null);
      setFocusedDesarrolloId(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [focusedCobroId, focusedDesarrolloId]);

  const handleToggleRecordatorio = async (c: Cobro) => {
    try {
      const res = await fetch(`/api/admin/cobros/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordatorioEnviado: !c.recordatorioEnviado }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar.");
        return;
      }
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al actualizar.");
    }
  };

  const handleEditCobro = (c: Cobro) => {
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
    setCobroError("");
    try {
      const res = await fetch(`/api/admin/cobros/${editingCobro.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: newAmount,
          servicio: editCobroServicio || undefined,
          dueDate: editCobroDueDate,
          updateFuture: editCobroUpdateFuture,
          clientName: editCobroUpdateFuture ? editingCobro.clientName : undefined,
          dueDateFrom: editCobroUpdateFuture ? editingCobro.dueDate : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo actualizar.");
        return;
      }
      setEditingCobro(null);
      setEditCobroAmount("");
      setEditCobroServicio("");
      setEditCobroDueDate("");
      setEditCobroUpdateFuture(false);
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al actualizar.");
    } finally {
      setCobroSubmitting(false);
    }
  };

  const handleDeleteCobro = async (c: Cobro) => {
    if (!window.confirm(`¿Eliminar cuota de ${c.clientName} - ${formatLocalDate(c.dueDate)} - $${c.amount.toLocaleString("es-AR")}?`)) return;
    try {
      const res = await fetch(`/api/admin/cobros/${c.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudo eliminar.");
        return;
      }
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al eliminar.");
    }
  };

  const handleDeleteAllCobrosOfClient = async (clientName: string) => {
    if (!window.confirm(`¿Eliminar todas las cuotas de ${clientName}?`)) return;
    try {
      const res = await fetch(`/api/admin/cobros?client=${encodeURIComponent(clientName)}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setCobroError(data?.error || "No se pudieron eliminar.");
        return;
      }
      setCobroFilterClient("");
      fetchCobros();
    } catch (e: any) {
      setCobroError(e?.message || "Error al eliminar.");
    }
  };

  const totalIngresos = filteredRecords
    .filter((r) => r.type === "ingreso" && (includeChamba || r.chamba !== true))
    .reduce((sum, r) => sum + r.amount, 0);
  const gastosDelMes = filteredRecords.filter((r) => r.type === "gasto");
  const totalGastos = gastosDelMes.reduce((sum, r) => sum + r.amount, 0);
  const totalHerramientas = gastosDelMes
    .filter((r) => isGastoHerramientas(r.category))
    .reduce((sum, r) => sum + r.amount, 0);
  const totalPlacer = gastosDelMes
    .filter((r) => isGastoPlacer(r.category))
    .reduce((sum, r) => sum + r.amount, 0);
  const totalInversion = filteredRecords
    .filter((r) => r.type === "inversion")
    .reduce((sum, r) => sum + r.amount, 0);
  const resultado =
    totalIngresos -
    gastosDelMes.filter((r) => !isGastoPlacer(r.category)).reduce((sum, r) => sum + r.amount, 0) -
    totalInversion;

  const formatCurrency = (n: number) =>
    `$${n.toLocaleString("es-AR")} ARS`;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <div className="flex items-center gap-2 mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Admin</h1>
          {isContabilidadPwa ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-1 pl-3">
              <div className="flex min-w-0 items-center gap-2">
                <FolderKanban className="h-5 w-5 shrink-0 text-[#84b9ed]" aria-hidden />
                <span className="truncate text-sm font-semibold text-slate-900">Contabilidad</span>
              </div>
              <Link
                href="/admin92"
                className="shrink-0 rounded-md px-3 sm:px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Panel completo
              </Link>
            </div>
          ) : (
            <div className="flex w-full rounded-lg border border-slate-200 p-1 overflow-x-auto sm:overflow-x-visible">
              <button
                type="button"
                onClick={() => setActiveTab("webhooks")}
                className={`rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "webhooks"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Webhooks
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("contabilidad")}
                className={`rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === "contabilidad"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                Contabilidad
              </button>
              <Link
                href="/admin92/contabilidad"
                className="rounded-md px-2 sm:px-3 py-2 text-xs font-medium text-[#84b9ed] hover:bg-slate-100 whitespace-nowrap self-center"
                title="Abrir en vista app (ideal para instalar acceso directo)"
              >
                App contabilidad
              </Link>
              <button
                type="button"
                onClick={() => setActiveTab("suscripciones")}
                className={`rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === "suscripciones"
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <BarChart3 className="w-4 h-4" />
                Suscripciones
              </button>
              <Link
                href="/admin92/proyectos"
                className="rounded-md px-3 sm:px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap text-slate-600 hover:bg-slate-100"
              >
                <FolderKanban className="w-4 h-4" />
                Proyectos
              </Link>
            </div>
          )}
        </div>

        {activeTab === "webhooks" && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-slate-600">
                  Fuente: <span className="font-semibold text-slate-900">{source}</span>
                </p>
                <select
                  value={webhookProviderFilter}
                  onChange={(e) => setWebhookProviderFilter(e.target.value as "all" | "mp" | "resend")}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                >
                  <option value="all">Todos (MP + Resend)</option>
                  <option value="mp">Mercado Pago</option>
                  <option value="resend">Resend</option>
                </select>
                <select
                  value={webhookTypeFilter}
                  onChange={(e) => setWebhookTypeFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                >
                  <option value="">Todos los tipos</option>
                  {webhookProviderFilter !== "resend" && (
                    <>
                      <option value="payment">MP: pagos (payment)</option>
                      <option value="subscription_preapproval">MP: preapproval</option>
                      <option value="subscription_authorized_payment">MP: pago autorizado</option>
                    </>
                  )}
                  {webhookProviderFilter !== "mp" && (
                    <>
                      <option value="email.sent">Resend: email.sent</option>
                      <option value="email.delivered">Resend: email.delivered</option>
                      <option value="email.failed">Resend: email.failed</option>
                      <option value="email.bounced">Resend: email.bounced</option>
                      <option value="email.opened">Resend: email.opened</option>
                      <option value="email.clicked">Resend: email.clicked</option>
                    </>
                  )}
                </select>
              </div>
              <button
                type="button"
                onClick={fetchEvents}
                className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  loading
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                    : "bg-[#84b9ed] text-white hover:bg-[#6ba3d9] cursor-pointer"
                }`}
                disabled={loading}
              >
                {loading ? "Cargando..." : "Actualizar"}
              </button>
            </div>

            {error && (
              <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="text-sm font-semibold">Atención</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-3">
              {events.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
                  {webhookProviderFilter === "resend"
                    ? "No hay eventos de Resend. Configurá el webhook en resend.com → Webhooks."
                    : webhookProviderFilter === "mp"
                      ? "No hay eventos de Mercado Pago. Probá el simulador o realizá una suscripción real."
                      : "No hay eventos aún."}
                </div>
              ) : (() => {
                const filtered = events.filter((evt) => {
                  if (!webhookTypeFilter) return true;
                  const t = evt.type ?? (evt.body as any)?.type ?? (evt.body as any)?.topic ?? evt.query?.type ?? "";
                  return t === webhookTypeFilter;
                });
                return filtered.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700">
                    No hay eventos con el filtro seleccionado. Probá otro tipo o "Todos los tipos".
                  </div>
                ) : (
                filtered.map((evt, idx) => (
                  <details
                    key={`${evt.provider}-${evt.receivedAt}-${idx}`}
                    className="group rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <summary className="cursor-pointer list-none">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-medium mr-2 ${evt.provider === "mp" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"}`}>
                              {evt.provider === "mp" ? "MP" : "Resend"}
                            </span>
                            {evt.path}{" "}
                            <span className="text-slate-500 font-normal">
                              • {new Date(evt.receivedAt).toLocaleString("es-AR")}
                            </span>
                          </p>
                          <p className="text-xs text-slate-600 truncate">
                            {evt.provider === "mp" && (
                              <>
                                Firma:{" "}
                                <span className={evt.signatureVerified ? "text-green-600" : "text-amber-700"}>
                                  {evt.signatureVerified ? "verificada" : "no verificada"}
                                </span>
                                {" • "}
                              </>
                            )}
                            type:{" "}
                            <span className="font-mono">{evt.type ?? (evt.body as any)?.type ?? (evt.body as any)?.topic ?? "—"}</span>
                            {evt.provider === "mp" && evt.summary?.amount != null && (
                              <>
                                {" • "}
                                <span className="font-semibold text-slate-900">
                                  ${evt.summary.amount.toLocaleString("es-AR")} {evt.summary.currency || "ARS"}
                                </span>
                              </>
                            )}
                            {evt.provider === "mp" && evt.summary?.payerEmail && (
                              <>
                                {" • "}
                                <span className="text-slate-500 truncate max-w-[120px] inline-block align-bottom" title={evt.summary.payerEmail}>
                                  {evt.summary.payerEmail}
                                </span>
                              </>
                            )}
                            {evt.provider === "resend" && (evt.body as any)?.data && (
                              <>
                                {" • "}
                                <span className="text-slate-500 truncate" title={(evt.body as any).data.to?.join?.(", ") ?? (evt.body as any).data.to}>
                                  to: {(Array.isArray((evt.body as any).data.to) ? (evt.body as any).data.to[0] : (evt.body as any).data.to) ?? "—"}
                                </span>
                                {(evt.body as any).data.subject && (
                                  <span className="text-slate-500 truncate max-w-[150px] inline-block align-bottom" title={(evt.body as any).data.subject}>
                                    {" • "}{(evt.body as any).data.subject}
                                  </span>
                                )}
                              </>
                            )}
                          </p>
                        </div>
                        <span className="text-xs text-slate-500 group-open:hidden">Ver</span>
                        <span className="text-xs text-slate-500 hidden group-open:inline">Cerrar</span>
                      </div>
                    </summary>

                    <div className="mt-4 grid grid-cols-1 gap-3">
                      {evt.provider === "mp" && evt.summary && (evt.summary.amount != null || evt.summary.payerEmail || evt.summary.status) && (
                        <div className="rounded-xl border border-[#84b9ed]/30 bg-[#84b9ed]/5 p-3">
                          <p className="text-xs font-semibold text-slate-700 mb-2">Resumen (MP)</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {evt.summary.amount != null && (
                              <span>
                                <strong>Monto:</strong> ${evt.summary.amount.toLocaleString("es-AR")} {evt.summary.currency || "ARS"}
                              </span>
                            )}
                            {evt.summary.payerEmail && (
                              <span>
                                <strong>Email:</strong> {evt.summary.payerEmail}
                              </span>
                            )}
                            {evt.summary.status && (
                              <span>
                                <strong>Estado:</strong> {evt.summary.status}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {evt.provider === "resend" && (evt.body as any)?.data && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                          <p className="text-xs font-semibold text-slate-700 mb-2">Resumen (Resend)</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                            {(evt.body as any).data.from && (
                              <span><strong>From:</strong> {(evt.body as any).data.from}</span>
                            )}
                            {(evt.body as any).data.to && (
                              <span><strong>To:</strong> {Array.isArray((evt.body as any).data.to) ? (evt.body as any).data.to.join(", ") : (evt.body as any).data.to}</span>
                            )}
                            {(evt.body as any).data.subject && (
                              <span><strong>Subject:</strong> {(evt.body as any).data.subject}</span>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Query</p>
                        <pre className="text-xs overflow-auto text-slate-800">
                          {JSON.stringify(evt.query ?? {}, null, 2)}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Headers</p>
                        <pre className="text-xs overflow-auto text-slate-800">
                          {JSON.stringify(evt.headers, null, 2)}
                        </pre>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs font-semibold text-slate-700 mb-2">Body</p>
                        <pre className="text-xs overflow-auto text-slate-800">
                          {JSON.stringify(evt.body, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </details>
                ))
                );
              })()}
            </div>
          </>
        )}

        {activeTab === "contabilidad" && (
          <div className="space-y-8">
            {/* Mes activo (sincronizado con el calendario) */}
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="text-xl font-semibold text-slate-900">
                {formatMonthLabel(contabilidadMonth)}
              </h2>
              <span className="text-sm text-slate-500">
                {filteredRecords.length} registro{filteredRecords.length !== 1 ? "s" : ""} · {filteredCobros.length} cuota{filteredCobros.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Resumen contable */}
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Real contable</p>
                  <ChambaToggle
                    icon
                    pressed={includeChamba}
                    onClick={() => setIncludeChamba((v) => !v)}
                  />
                </div>
                <Link
                  href="/admin92/contabilidad/cartera"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
                >
                  Cartera de inversiones
                </Link>
              </div>
              <div className="grid grid-cols-1 min-[520px]:grid-cols-2 min-[1000px]:grid-cols-4 gap-4 items-start">
              <div className="rounded-xl border border-slate-200 bg-green-50/50 p-4">
                <p className="text-xs font-medium text-slate-600 mb-1">Ingresos</p>
                <p className="text-xl font-bold text-green-700">{formatCurrency(totalIngresos)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-red-50/50 p-4">
                <p className="text-xs font-medium text-slate-600 mb-1">Gastos</p>
                <p className="text-xl font-bold text-red-700">{formatCurrency(totalGastos)}</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-xs font-medium text-slate-900">
                      <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">Herramientas</span>
                    </p>
                    <p className="text-xs font-medium text-slate-900">{formatCurrency(totalHerramientas)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 text-xs font-medium text-slate-900">
                      <Smile className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">Placer</span>
                    </p>
                    <p className="text-xs font-medium text-slate-900">{formatCurrency(totalPlacer)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-blue-50/50 p-4">
                <p className="text-xs font-medium text-slate-600 mb-1">Inversión</p>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(totalInversion)}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-medium text-slate-600 mb-1">Resultado</p>
                <p className={`text-xl font-bold ${resultado >= 0 ? "text-green-700" : "text-red-700"}`}>
                  {formatCurrency(resultado)}
                </p>
              </div>
              </div>
            </div>

            {/* Cobranza del mes */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Cobranza del mes</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-slate-200 bg-amber-50/40 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-1">Esperado</p>
                  <p className="text-xl font-bold text-amber-800">{formatCurrency(cobranzaKpis.esperado)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-green-50/40 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-1">Cobrado</p>
                  <p className="text-xl font-bold text-green-700">{formatCurrency(cobranzaKpis.cobrado)}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-orange-50/40 p-4">
                  <p className="text-xs font-medium text-slate-600 mb-1">Pendiente</p>
                  <p className="text-xl font-bold text-orange-700">{formatCurrency(cobranzaKpis.pendiente)}</p>
                </div>
              </div>
            </div>

            {/* Formulario */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-slate-900">
                    {editingRecord ? "Editar registro" : "Otros ingresos y movimientos"}
                  </h2>
                  {!editingRecord && (
                    <button
                      type="button"
                      onClick={() => setShowNewRecordForm((v) => !v)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {showNewRecordForm ? "Ocultar formulario" : "Ver formulario"}
                    </button>
                  )}
                </div>
                {editingRecord && (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="text-sm font-medium text-slate-600 hover:text-slate-900"
                  >
                    Cancelar
                  </button>
                )}
              </div>
              {!editingRecord && !showNewRecordForm ? (
                <p className="text-sm text-slate-600">
                  Cuotas: marcá pagada en el día del calendario. Desarrollos 50%: panel en el pie del
                  calendario.
                </p>
              ) : (
                <form onSubmit={handleSubmitRecord} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tipo</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as AccountingType)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    >
                      <option value="ingreso" className="bg-white text-slate-900">Ingreso</option>
                      <option value="gasto" className="bg-white text-slate-900">Gasto</option>
                      <option value="inversion" className="bg-white text-slate-900">Inversión</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Monto (ARS)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="25000"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Suscripción cliente X"
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                    <DatePickerField
                      value={formDate}
                      onChange={setFormDate}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      {formType === "gasto" ? "Categoría" : "Categoría (opcional)"}
                    </label>
                    {formType === "gasto" ? (
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 cursor-pointer"
                      >
                        <option value="">Elegí</option>
                        {gastoCategoryOptions(formCategory).map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value)}
                        placeholder="Web, App, hosting…"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                      />
                    )}
                  </div>
                  <div className="flex items-end gap-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`rounded-lg px-6 py-2.5 text-sm font-semibold transition-colors ${
                        submitting
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : "bg-[#84b9ed] text-white hover:bg-[#6ba3d9] cursor-pointer"
                      }`}
                    >
                      {submitting
                        ? "Guardando..."
                        : editingRecord
                          ? "Guardar cambios"
                          : "Agregar"}
                    </button>
                  </div>
                </form>
              )}
              {accError && (
                <p className="mt-3 text-sm text-red-600">{accError}</p>
              )}
            </div>

            {/* Herramientas del calendario */}
            <div>
              <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-wide">Herramientas</p>
              <div className="flex flex-wrap items-start gap-2">
                {(
                  [
                    { id: "objetivos", label: "Objetivos" },
                    { id: "mantenimientos", label: "Mantenimientos" },
                    { id: "buscar-clientes", label: "Buscar clientes" },
                  ] as const
                ).map(({ id, label }) => {
                  const active = contabilidadToolPanel === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setContabilidadToolPanel((prev) => (prev === id ? null : id))}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer ${
                        active
                          ? "border-[#84b9ed] bg-[#84b9ed]/10 text-[#4a7fb8] ring-2 ring-[#84b9ed]/30"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
                <Link
                  href="/admin92/erp"
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 transition-colors hover:border-blue-300 hover:bg-blue-100"
                >
                  ERP
                </Link>
                <button
                  type="button"
                  onClick={() => setStackOpen(true)}
                  className="ml-auto inline-block translate-y-3 cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Stack
                </button>
              </div>
              {stackOpen && <StackModal onClose={() => setStackOpen(false)} />}
              {contabilidadToolPanel === "objetivos" && (
                <HerramientasPanel
                  section="objetivos"
                  title="Objetivos"
                  monthKey={contabilidadMonth}
                  monthLabel={formatMonthLabel(contabilidadMonth)}
                  hint="Metas de ingreso, margen y cobranza del mes. Cada objetivo queda asociado al mes del calendario."
                />
              )}
              {contabilidadToolPanel === "mantenimientos" && (
                <HerramientasPanel
                  section="mantenimientos"
                  title="Mantenimientos"
                  hint="Contratos, servicios y tareas de mantenimiento de clientes."
                  wordOnlineUrl={WORD_ONLINE_URL || undefined}
                />
              )}
              {contabilidadToolPanel === "buscar-clientes" && (
                <HerramientasPanel
                  section="buscar-clientes"
                  title="Buscar clientes"
                  hint="Notas, criterios de búsqueda e ideas para el explorador de clientes."
                />
              )}
            </div>

            {/* Calendario + cola de cambios */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(260px,300px)] gap-4 items-start">
              <MonthCalendar
                month={contabilidadMonth}
                selectedDate={selectedDate}
                markers={calendarMarkers}
                cuotasDelMes={cobrosEnMes.length}
                desarrollosRefreshKey={desarrollosRefreshKey}
                onDesarrollosAccountingChange={() => {
                  fetchRecords();
                  void fetchDesarrollos50();
                }}
                onSelectDate={(date) => {
                  setFocusedCobroId(null);
                  setFocusedDesarrolloId(null);
                  setSelectedDate((prev) => (prev === date ? null : date));
                }}
                onPrevMonth={() => {
                  setContabilidadMonth((m) => shiftMonth(m, -1));
                  setSelectedDate(null);
                  setFocusedCobroId(null);
                  setFocusedDesarrolloId(null);
                }}
                onNextMonth={() => {
                  setContabilidadMonth((m) => shiftMonth(m, 1));
                  setSelectedDate(null);
                  setFocusedCobroId(null);
                  setFocusedDesarrolloId(null);
                }}
                cuotaTimersOpen={cuotaTimersOpen}
                onToggleCuotaTimers={() =>
                  setCuotaTimersOpen((open) => {
                    if (!open) setCuotaTimersLoading(true);
                    return !open;
                  })
                }
                cuotaTimerRows={cuotaTimerRows}
                cuotaTimersLoading={cuotaTimersLoading}
                cuotaTimersError={cuotaTimersError}
              />
              <CambiosPendientesSidebar
                className="hidden lg:block"
                cuotas={cuotasConCambioPendiente}
                tareas={tareasCambioMes}
                mesesAtrasados={mesesConCambiosAtrasados}
                onGoToMesAtrasado={handleGoToMesCambiosAtrasados}
                labelFor={(c) =>
                  c.source === "desarrollo50"
                    ? `${c.clientName} — ${c.servicio || "Desarrollo"} · 50%`
                    : c.servicio
                      ? `${c.clientName} (${c.servicio}) - Cuota`
                      : `${c.clientName} - Cuota`
                }
                selectedCobroId={focusedCobroId}
                selectedDesarrolloId={focusedDesarrolloId}
                sortMode={cambiosSortMode}
                onSortModeChange={setCambiosSortMode}
                onSelectCuota={handleSelectCuotaFromSidebar}
                onPrioridadChange={handleCobroPrioridadChange}
                onDismissTaskFromColaActiva={handleDismissTaskFromColaActiva}
              />
            </div>
            <CambiosPendientesSidebar
              collapsible
              cuotas={cuotasConCambioPendiente}
              tareas={tareasCambioMes}
              mesesAtrasados={mesesConCambiosAtrasados}
              onGoToMesAtrasado={handleGoToMesCambiosAtrasados}
              labelFor={(c) =>
                c.source === "desarrollo50"
                  ? `${c.clientName} — ${c.servicio || "Desarrollo"} · 50%`
                  : c.servicio
                    ? `${c.clientName} (${c.servicio}) - Cuota`
                    : `${c.clientName} - Cuota`
              }
              selectedCobroId={focusedCobroId}
              selectedDesarrolloId={focusedDesarrolloId}
              sortMode={cambiosSortMode}
              onSortModeChange={setCambiosSortMode}
              onSelectCuota={handleSelectCuotaFromSidebar}
              onPrioridadChange={handleCobroPrioridadChange}
              onDismissTaskFromColaActiva={handleDismissTaskFromColaActiva}
            />

            {/* Detalle del día / mes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedDate
                      ? `Movimientos del ${formatLocalDate(selectedDate)}`
                      : `Registros de ${formatMonthLabel(contabilidadMonth)}`}
                  </h2>
                  {cobranzaProgreso.esperadoTotal > 0 && (
                    <p className="mt-1.5 text-sm text-slate-600">
                      {selectedDate ? (
                        <>
                          Al {formatLocalDate(selectedDate)}:{" "}
                          <span className="font-medium text-green-700">
                            Ganado {formatCurrency(cobranzaProgreso.ganadoHasta)}
                          </span>
                          {" · "}
                          <span className="font-medium text-orange-700">
                            Se espera {formatCurrency(cobranzaProgreso.esperadoRestante)}
                          </span>
                        </>
                      ) : cobranzaProgreso.asOfDate ? (
                        <>
                          Ganado hasta el momento:{" "}
                          <span className="font-medium text-green-700">
                            {formatCurrency(cobranzaProgreso.ganadoHasta)}
                          </span>
                          {" · "}
                          Se espera ganar:{" "}
                          <span className="font-medium text-orange-700">
                            {formatCurrency(cobranzaProgreso.esperadoRestante)}
                          </span>
                          <span className="text-slate-400">
                            {" "}(total mes {formatCurrency(cobranzaProgreso.esperadoTotal)})
                          </span>
                        </>
                      ) : (
                        <>
                          Se espera ganar:{" "}
                          <span className="font-medium text-orange-700">
                            {formatCurrency(cobranzaProgreso.esperadoRestante)}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    fetchRecords();
                    fetchCobros();
                    fetchProyectos();
                  }}
                  disabled={accLoading}
                  className="text-sm font-medium text-[#84b9ed] hover:text-[#6ba3d9] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  {accLoading ? "Cargando..." : "Actualizar"}
                </button>
              </div>

              {pendingPaidCobro && (
                <div ref={confirmPagoRef}>
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
                  {cobroError && (
                    <p className="mt-2 text-sm text-red-600">{cobroError}</p>
                  )}
                </div>
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
                      className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 cursor-pointer disabled:opacity-50"
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
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-white cursor-pointer"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {accLoading && records.length === 0 && cobroLoading && cobros.length === 0 ? (
                <p className="text-slate-600 py-8 text-center">Cargando...</p>
              ) : dayRecords.length === 0 && dayCuotas.length === 0 && dayDesarrollos50.length === 0 ? (
                <p className="text-slate-600 py-8 text-center">
                  {selectedDate
                    ? "No hay movimientos, cuotas ni desarrollos 50% este día."
                    : `No hay registros para ${formatMonthLabel(contabilidadMonth)}.`}
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Cuotas del mes ocultas; solo detalle del día al clic en el calendario */}
                  {selectedDate && dayDesarrollos50.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">
                        Desarrollos 50% del día
                      </h3>
                      <div className="space-y-2">
                        {dayDesarrollos50.map((d) => {
                          const isFocused = focusedDesarrolloId === d.id;
                          return (
                          <div
                            key={d.id}
                            id={`desarrollo-row-${d.id}`}
                            data-desarrollo-block={d.id}
                            className={`rounded-xl border border-sky-200 bg-sky-50/40 p-3 ${
                              isFocused ? "ring-2 ring-amber-400 border-amber-300" : ""
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-900">
                                  {d.clientName}
                                  <span className="font-normal text-slate-500"> — {d.name}</span>
                                </p>
                                <p className="text-xs text-slate-600 mt-0.5">
                                  {d.type !== "—" ? `${d.type} · ` : ""}
                                  1.er 50%
                                  {d.montoCobrado50 !== undefined
                                    ? ` · $${d.montoCobrado50.toLocaleString("es-AR")} ARS`
                                    : ""}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
                                Desarrollo 50%
                              </span>
                            </div>
                            <Desarrollo50TasksBlock
                              desarrollo={d}
                              onUpdated={() => void fetchDesarrollos50()}
                            />
                          </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {selectedDate && dayCuotas.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">Cuotas del día</h3>
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Vencimiento</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Cobro</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Tipo</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Descripción</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Servicio</th>
                              <th className="text-left py-2 px-2 font-semibold text-slate-700">Origen</th>
                              <th className="text-right py-2 px-2 font-semibold text-slate-700">Monto</th>
                              <th className="text-center py-2 px-2 font-semibold text-slate-700">Recordatorio</th>
                              <th className="text-right py-2 px-2 font-semibold text-slate-700">Acción</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dayCuotas.map((c) => {
                              const estado = getCuotaEstado(c);
                              const est = cuotaEstadoStyles[estado];
                              const isFocused = focusedCobroId === c.id;
                              return (
                              <Fragment key={c.id}>
                                <tr
                                  id={`cuota-row-${c.id}`}
                                  data-cuota-block={c.id}
                                  className={`border-b ${est.row} ${
                                    isFocused ? "ring-2 ring-amber-400 ring-inset bg-amber-50/50" : ""
                                  }`}
                                >
                                  <td className="py-2.5 px-2 text-slate-600">{formatLocalDate(c.dueDate)}</td>
                                  <td className="py-2.5 px-2 text-slate-600">
                                    {c.paid ? (
                                      <DatePickerField
                                        value={cuotaFechaCobroYmd(c)}
                                        onChange={(ymd) => void handleFechaCobroChange(c, ymd)}
                                        title="Fecha de cobro"
                                        aria-label="Fecha de cobro"
                                        className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-800"
                                      />
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2">
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${est.badge}`}>
                                      {CUOTA_ESTADO_LABEL[estado]}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-2 min-w-[160px]">
                                    <input
                                      type="text"
                                      defaultValue={getCuotaDescripcion(c)}
                                      key={`${c.id}-desc-${c.descripcionCuota ?? ""}`}
                                      onBlur={(e) => void handleDescripcionCuotaChange(c, e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") e.currentTarget.blur();
                                      }}
                                      title="Descripción de la cuota"
                                      aria-label="Descripción de la cuota"
                                      className="w-full min-w-[140px] rounded border border-transparent bg-transparent px-1 py-0.5 text-slate-900 outline-none focus:border-slate-300 focus:bg-white"
                                    />
                                  </td>
                                  <td className="py-2.5 px-2 text-slate-600">{c.servicio || "—"}</td>
                                  <td className="py-2.5 px-2 text-slate-500">
                                    {c.origen === "suscripcion_mp" ? "Suscripción MP" : "Manual"}
                                  </td>
                                  <td className={`py-2.5 px-2 text-right font-medium ${est.amount}`}>
                                    {formatCurrency(c.amount)}
                                  </td>
                                  <td className="py-2.5 px-2 text-center">
                                    {!c.paid ? (
                                      <button
                                        type="button"
                                        onClick={() => handleToggleRecordatorio(c)}
                                        title={
                                          c.recordatorioEnviado
                                            ? "Quitar recordatorio enviado"
                                            : "Marcar recordatorio enviado"
                                        }
                                        className={`inline-flex items-center justify-center w-8 h-8 rounded-lg border-2 transition-colors cursor-pointer ${
                                          c.recordatorioEnviado
                                            ? "border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200"
                                            : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-50"
                                        }`}
                                      >
                                        {c.recordatorioEnviado ? <Check className="w-4 h-4" /> : null}
                                      </button>
                                    ) : (
                                      <span className="text-slate-300">—</span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePaid(c)}
                                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${
                                        c.paid
                                          ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                          : "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                                      }`}
                                    >
                                      {c.paid ? "Marcar pendiente" : "Marcar pagada"}
                                    </button>
                                  </td>
                                </tr>
                                <tr
                                  data-cuota-block={c.id}
                                  className={`border-b ${est.rowSub} ${
                                    isFocused ? "bg-amber-50/30" : ""
                                  }`}
                                >
                                  <td colSpan={9} className="px-2 pb-2.5 pt-0 space-y-2">
                                    <CuotaOperativaPanel
                                      cobro={c}
                                      proyecto={getProyectoForClient(c.clientName, proyectoByClient)}
                                      onCobroUpdated={fetchCobros}
                                      onProyectoUpdated={fetchProyectos}
                                    />
                                    <CuotaNotaEditor
                                      cobroId={c.id}
                                      notes={c.notes}
                                      onSaved={fetchCobros}
                                    />
                                  </td>
                                </tr>
                              </Fragment>
                            );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="sm:hidden space-y-2">
                        {dayCuotas.map((c) => {
                          const estado = getCuotaEstado(c);
                          const est = cuotaEstadoStyles[estado];
                          const isFocused = focusedCobroId === c.id;
                          return (
                          <div
                            key={c.id}
                            id={`cuota-row-${c.id}`}
                            data-cuota-block={c.id}
                            className={`rounded-xl border p-3 ${est.card} ${
                              isFocused ? "ring-2 ring-amber-400 border-amber-300" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${est.badge}`}>
                                {CUOTA_ESTADO_LABEL[estado]}
                              </span>
                              <span className={`text-sm font-semibold ${est.amount}`}>{formatCurrency(c.amount)}</span>
                            </div>
                            <input
                              type="text"
                              defaultValue={getCuotaDescripcion(c)}
                              key={`${c.id}-desc-m-${c.descripcionCuota ?? ""}`}
                              onBlur={(e) => void handleDescripcionCuotaChange(c, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                              }}
                              title="Descripción de la cuota"
                              aria-label="Descripción de la cuota"
                              className="mt-2 w-full rounded border border-slate-200 bg-white px-2 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-[#84b9ed] focus:ring-1 focus:ring-[#84b9ed]/30"
                            />
                            <div className="text-xs text-slate-500 mt-1">
                              {c.servicio ? (
                                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 mr-1.5">
                                  {c.servicio}
                                </span>
                              ) : null}
                              Vence {formatLocalDate(c.dueDate)}
                              {c.paid && (
                                <>
                                  {" · Cobró "}
                                  <DatePickerField
                                    value={cuotaFechaCobroYmd(c)}
                                    onChange={(ymd) => void handleFechaCobroChange(c, ymd)}
                                    title="Fecha de cobro"
                                    aria-label="Fecha de cobro"
                                    className="rounded border border-green-200 bg-green-50 px-1 py-0.5 text-[11px] text-green-800 align-middle"
                                  />
                                </>
                              )}
                              {" · "}
                              {c.origen === "suscripcion_mp" ? "Suscripción MP" : "Manual"}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {!c.paid && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRecordatorio(c)}
                                  title={
                                    c.recordatorioEnviado
                                      ? "Quitar recordatorio enviado"
                                      : "Marcar recordatorio enviado"
                                  }
                                  className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                    c.recordatorioEnviado
                                      ? "border-blue-500 bg-blue-100 text-blue-800 hover:bg-blue-200"
                                      : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {c.recordatorioEnviado ? <Check className="w-3.5 h-3.5" /> : null}
                                  {c.recordatorioEnviado ? "Recordado" : "Marcar recordado"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleTogglePaid(c)}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium cursor-pointer ${
                                  c.paid
                                    ? "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                                    : "border-green-300 bg-green-50 text-green-800 hover:bg-green-100"
                                }`}
                              >
                                {c.paid ? "Marcar pendiente" : "Marcar pagada"}
                              </button>
                            </div>
                            <CuotaOperativaPanel
                              cobro={c}
                              proyecto={getProyectoForClient(c.clientName, proyectoByClient)}
                              onCobroUpdated={fetchCobros}
                              onProyectoUpdated={fetchProyectos}
                              compact
                            />
                            <CuotaNotaEditor
                              cobroId={c.id}
                              notes={c.notes}
                              onSaved={fetchCobros}
                              compact
                            />
                          </div>
                        );
                        })}
                      </div>
                    </div>
                  )}

                  {dayRecords.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800 mb-3">Registros contables</h3>
                      <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200">
                            <th className="text-left py-3 px-2 font-semibold text-slate-700">Fecha</th>
                            <th className="text-left py-3 px-2 font-semibold text-slate-700">Tipo</th>
                            <th className="text-left py-3 px-2 font-semibold text-slate-700">Descripción</th>
                            <th className="text-left py-3 px-2 font-semibold text-slate-700">Categoría</th>
                            <th className="text-right py-3 px-2 font-semibold text-slate-700">Monto</th>
                            <th className="text-right py-3 px-2 font-semibold text-slate-700">Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dayRecords.map((r) => (
                            <tr
                              key={r._id || r.createdAt}
                              className="border-b border-slate-100 hover:bg-slate-50/50"
                            >
                              <td className="py-3 px-2 text-slate-600">
                                {new Date(r.date).toLocaleDateString("es-AR")}
                              </td>
                              <td className="py-3 px-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[r.type]}`}
                                >
                                  {typeLabels[r.type]}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-slate-900">{r.description}</td>
                              <td className="py-3 px-2 text-slate-500">{r.category || "—"}</td>
                              <td className="py-3 px-2 text-right font-medium">
                                <span
                                  className={
                                    r.type === "gasto" || r.type === "inversion"
                                      ? "text-red-600"
                                      : "text-green-600"
                                  }
                                >
                                  {r.type === "gasto" || r.type === "inversion" ? "-" : "+"}
                                  {formatCurrency(r.amount)}
                                </span>
                              </td>
                              <td className="py-3 px-2 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {r.type === "ingreso" && r._id ? (
                                    <ChambaToggle
                                      icon
                                      pressed={r.chamba === true}
                                      onClick={() => void handleToggleRecordChamba(r)}
                                    />
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(r)}
                                    title="Editar"
                                    aria-label="Editar"
                                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#84b9ed] transition-colors"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(r)}
                                    title="Eliminar"
                                    aria-label="Eliminar"
                                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile: cards */}
                    <div className="sm:hidden space-y-2">
                      {dayRecords.map((r) => (
                        <div
                          key={r._id || r.createdAt}
                          className="rounded-xl border border-slate-200 bg-white p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs text-slate-500">Fecha</p>
                              <p className="text-sm font-medium text-slate-900">
                                {new Date(r.date).toLocaleDateString("es-AR")}
                              </p>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${typeColors[r.type]}`}
                            >
                              {typeLabels[r.type]}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1.5">
                            <div>
                              <p className="text-xs text-slate-500">Descripción</p>
                              <p className="text-sm text-slate-900">{r.description}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Categoría</p>
                              <p className="text-sm text-slate-600">{r.category || "—"}</p>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs text-slate-500">Monto</p>
                              <p
                                className={`text-sm font-semibold ${
                                  r.type === "gasto" || r.type === "inversion"
                                    ? "text-red-600"
                                    : "text-green-600"
                                }`}
                              >
                                {r.type === "gasto" || r.type === "inversion" ? "-" : "+"}
                                {formatCurrency(r.amount)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                            {r.type === "ingreso" && r._id ? (
                              <ChambaToggle
                                icon
                                pressed={r.chamba === true}
                                onClick={() => void handleToggleRecordChamba(r)}
                              />
                            ) : null}
                            <button
                              type="button"
                              onClick={() => handleEdit(r)}
                              title="Editar"
                              aria-label="Editar"
                              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#84b9ed] transition-colors"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(r)}
                              title="Eliminar"
                              aria-label="Eliminar"
                              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Cuotas del mes */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Cuotas del mes</h2>
                <div className="flex items-center gap-3">
                  {WORD_ONLINE_URL ? (
                    <a
                      href={WORD_ONLINE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors"
                    >
                      <FileText className="h-4 w-4 shrink-0 text-[#84b9ed]" aria-hidden />
                      Word online
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={fetchCobros}
                    disabled={cobroLoading}
                    className="text-sm font-medium text-[#84b9ed] hover:text-[#6ba3d9] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {cobroLoading ? "Cargando..." : "Actualizar"}
                  </button>
                </div>
              </div>
              {cobroError && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-800 text-sm">
                  {cobroError}
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
                    cobroFormMode === "single" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Cuota única
                </button>
                <button
                  type="button"
                  onClick={() => setCobroFormMode("recurrent")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer ${
                    cobroFormMode === "recurrent" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Cuotas recurrentes
                </button>
                <button
                  type="button"
                  onClick={() => setCobroFormMode("actions")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                    cobroFormMode === "actions" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
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
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 hover:bg-amber-300 cursor-pointer"
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
                                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 hover:bg-amber-300 cursor-pointer"
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
                                      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-amber-200 text-amber-900 hover:bg-amber-300 cursor-pointer"
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
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-violet-200 text-violet-900 hover:bg-violet-300 cursor-pointer"
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
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
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
                            cobroSubmitting ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white hover:bg-[#6ba3d9]"
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
                        cobroSubmitting ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white hover:bg-[#6ba3d9]"
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
                          cobroSubmitting ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white hover:bg-[#6ba3d9]"
                        }`}
                      >
                        {cobroSubmitting ? "Guardando..." : "Guardar"}
                      </button>
                      <button
                        type="button"
                        onClick={handleCancelEditCobro}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 cursor-pointer"
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
                    <span className="text-slate-500">{" "}· Mes: {formatMonthLabel(contabilidadMonth)}</span>
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
                          No hay cuotas. Agregá una cuota única o generá cuotas recurrentes.
                        </td>
                      </tr>
                    ) : (
                      filteredCobros.map((c) => {
                        const estado = getCuotaEstado(c);
                        const rowTint =
                          estado === "pagada"
                            ? "bg-green-50/30"
                            : estado === "recordada"
                              ? "bg-blue-50/30"
                              : "";
                        return (
                        <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50/50 ${rowTint}`}>
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
                                  ? "border-green-500 bg-green-100 text-green-700 hover:bg-green-200"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-50"
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
                                  ? "border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-50"
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
                                  ? "border-blue-500 bg-blue-100 text-blue-700 hover:bg-blue-200"
                                  : "border-slate-300 bg-white text-slate-400 hover:border-slate-400 hover:bg-slate-50"
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
                                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#84b9ed] transition-colors cursor-pointer"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              {copyRow?.id === c.id ? (
                                <span className="inline-flex items-center gap-1">
                                  <select
                                    value={copyRow.month}
                                    onChange={(e) =>
                                      setCopyRow({ id: c.id, month: e.target.value })
                                    }
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
                                    className="rounded-lg bg-[#84b9ed] px-2 py-1 text-xs font-semibold text-white hover:bg-[#6ba3d9] cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
                                  >
                                    Pegar
                                  </button>
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleEditCobro(c)}
                                title="Editar"
                                aria-label="Editar"
                                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-[#84b9ed] transition-colors cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCobro(c)}
                                title="Eliminar"
                                aria-label="Eliminar"
                                className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-red-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "suscripciones" && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-slate-600">
                Asigná el <strong>Property ID</strong> de GA4 a cada suscripción para que el cliente vea estadísticas reales en Mi cuenta.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
                  Pendientes: {pendingSubscriptionsCount}
                </span>
                <button
                  type="button"
                  onClick={fetchSubscriptions}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                    subLoading ? "bg-slate-200 text-slate-500 cursor-not-allowed" : "bg-[#84b9ed] text-white hover:bg-[#6ba3d9] cursor-pointer"
                  }`}
                  disabled={subLoading}
                >
                  {subLoading ? "Cargando..." : "Actualizar"}
                </button>
              </div>
            </div>

            {(subError || searchParams.get("impersonate") === "error" || searchParams.get("impersonate") === "notfound") && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="text-sm">
                  {searchParams.get("impersonate") === "notfound"
                    ? "Suscripción no encontrada o cancelada."
                    : searchParams.get("impersonate") === "error"
                      ? "Error al iniciar sesión como usuario."
                      : subError}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <label className="text-sm font-medium text-slate-700">Filtrar estado:</label>
                <select
                  value={subStatusFilter}
                  onChange={(e) => setSubStatusFilter(e.target.value as "all" | "pending" | "authorized" | "other")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent cursor-pointer"
                >
                  <option value="all">Todos</option>
                  <option value="pending">Pendientes</option>
                  <option value="authorized">Autorizadas</option>
                  <option value="other">Otros estados</option>
                </select>
                <span className="text-xs text-slate-500">{filteredSubscriptions.length} suscripción(es)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Plan</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">Estado</th>
                      <th className="text-left py-3 px-4 font-semibold text-slate-700">GA4 Property ID</th>
                      <th className="text-right py-3 px-4 font-semibold text-slate-700">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subLoading && subscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          Cargando...
                        </td>
                      </tr>
                    ) : filteredSubscriptions.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-500">
                          No hay suscripciones para el filtro seleccionado.
                        </td>
                      </tr>
                    ) : (
                      filteredSubscriptions.map((s) => (
                        <tr key={s.preapprovalId} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-medium text-slate-900">{s.email}</td>
                          <td className="py-3 px-4 text-slate-600">{s.plan}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                s.status === "authorized"
                                  ? "bg-green-100 text-green-800"
                                  : s.status === "pending"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {s.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {editingSub?.preapprovalId === s.preapprovalId ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editGa4PropertyId}
                                  onChange={(e) => setEditGa4PropertyId(e.target.value)}
                                  placeholder="Ej. 432109876"
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm w-40 focus:ring-2 focus:ring-[#84b9ed] focus:border-transparent"
                                />
                                <button
                                  type="button"
                                  onClick={handleSaveGa4PropertyId}
                                  disabled={subSaving}
                                  className="rounded-lg bg-[#84b9ed] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6ba3d9] disabled:opacity-60 cursor-pointer"
                                >
                                  {subSaving ? "Guardando..." : "Guardar"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setEditingSub(null); setEditGa4PropertyId(""); }}
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-600 font-mono">{s.ga4PropertyId || "—"}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {editingSub?.preapprovalId === s.preapprovalId ? null : (
                              <div className="flex items-center justify-end gap-2">
                                {s.status === "pending" && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleCopy(
                                        `Hola ${s.name || ""}, te escribo de Glomun.\nTu suscripción figura como pendiente en Mercado Pago y falta terminar la confirmación del medio de pago para activarla.\nCuando quieras te paso el enlace para completarlo.`,
                                        `sub-pending-${s.preapprovalId}`,
                                      )
                                    }
                                    className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 cursor-pointer"
                                    title="Copiar mensaje de seguimiento"
                                  >
                                    {copiedId === `sub-pending-${s.preapprovalId}` ? "Copiado" : "Copiar seguimiento"}
                                  </button>
                                )}
                                <a
                                  href={`/api/admin/impersonate?preapprovalId=${encodeURIComponent(s.preapprovalId)}`}
                                  className="inline-flex items-center gap-1 rounded-lg bg-[#84b9ed] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#6ba3d9]"
                                  title="Entrar a Mi cuenta como este usuario"
                                >
                                  Ver como usuario
                                </a>
                                <Link
                                  href={`/admin92/suscripciones/${encodeURIComponent(s.preapprovalId)}/metricas`}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                                  title="Cargar métricas de performance"
                                >
                                  Métricas
                                </Link>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSub(s);
                                    setEditGa4PropertyId(s.ga4PropertyId || "");
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                                >
                                  <Pencil className="w-4 h-4" />
                                  {s.ga4PropertyId ? "Editar GA4" : "Asignar GA4"}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Admin92Page() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white flex items-center justify-center">
          <p className="text-slate-500">Cargando...</p>
        </main>
      }
    >
      <Admin92PageContent />
    </Suspense>
  );
}
