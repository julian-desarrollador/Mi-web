export const ENTREGABLE_STATUSES = ["pending", "in_progress", "done"] as const;

export type EntregableStatus = (typeof ENTREGABLE_STATUSES)[number];

export const ENTREGABLE_DAY_PARTS = ["morning", "afternoon", "night"] as const;

export type EntregableDayPart = (typeof ENTREGABLE_DAY_PARTS)[number];

export const ENTREGABLE_DAY_PART_LABEL: Record<EntregableDayPart, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  night: "Noche",
};

export const ENTREGABLE_STATUS_LABEL: Record<EntregableStatus, string> = {
  pending: "Pendiente",
  in_progress: "En proceso",
  done: "Hecho",
};

export type ErpEntregableSubtask = {
  id: string;
  title: string;
  done: boolean;
  dueOn: string | null;
  createdAt: string;
};

export type ErpEntregable = {
  _id: string;
  blockId: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  dayPart: EntregableDayPart | null;
  status: EntregableStatus;
  subtasks: ErpEntregableSubtask[];
  createdAt: string;
  updatedAt: string;
};

export type ErpEntregableBlock = {
  _id: string;
  name: string;
  order: number;
  createdAt: string;
  updatedAt: string;
  items: ErpEntregable[];
};

export type ErpEntregableBlockInput = {
  name: string;
};

export type ErpEntregableInput = {
  blockId: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  dayPart: EntregableDayPart | null;
  status: EntregableStatus;
  subtasks: ErpEntregableSubtask[];
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SUBTASK_ID_PATTERN = /^[a-zA-Z0-9_-]{8,40}$/;
const NAME_MAX = 80;
const BLOCK_ORDER_MAX = 100;
const TITLE_MAX = 200;
const DESCRIPTION_MAX = 2000;
const SUBTASK_MAX = 30;

const STATUS_RANK: Record<EntregableStatus, number> = {
  in_progress: 0,
  pending: 1,
  done: 2,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseName(value: unknown): string | { error: string } {
  const name = String(value ?? "").trim();
  if (!name) return { error: "El nombre del bloque es requerido" };
  if (name.length > NAME_MAX) {
    return { error: `El nombre no puede superar ${NAME_MAX} caracteres` };
  }
  return name;
}

function parseTitle(value: unknown): string | { error: string } {
  const title = String(value ?? "").trim();
  if (!title) return { error: "El título es requerido" };
  if (title.length > TITLE_MAX) {
    return { error: `El título no puede superar ${TITLE_MAX} caracteres` };
  }
  return title;
}

function parseDescription(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined) return null;
  const description = String(value).trim();
  if (!description) return null;
  if (description.length > DESCRIPTION_MAX) {
    return { error: `La descripción no puede superar ${DESCRIPTION_MAX} caracteres` };
  }
  return description;
}

function parseDueOn(value: unknown): string | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  const dueOn = String(value).trim();
  if (!dueOn) return null;
  if (!DATE_PATTERN.test(dueOn)) return { error: "La fecha debe ser YYYY-MM-DD" };
  return dueOn;
}

function parseDayPart(value: unknown): EntregableDayPart | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  const dayPart = String(value).trim();
  if (!ENTREGABLE_DAY_PARTS.includes(dayPart as EntregableDayPart)) {
    return { error: "El momento del día no es válido" };
  }
  return dayPart as EntregableDayPart;
}

function parseStatus(value: unknown): EntregableStatus | { error: string } {
  const status = String(value ?? "").trim();
  if (!ENTREGABLE_STATUSES.includes(status as EntregableStatus)) {
    return { error: "El estado no es válido" };
  }
  return status as EntregableStatus;
}

function parseSubtaskId(value: unknown): string {
  const id = String(value ?? "").trim();
  if (SUBTASK_ID_PATTERN.test(id)) return id;
  return crypto.randomUUID();
}

function parseSubtaskCreatedAt(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }
  return new Date().toISOString();
}

function parseSubtasks(
  value: unknown,
  allowMissing: boolean,
): ErpEntregableSubtask[] | { error: string } {
  if (value === undefined || value === null) {
    if (allowMissing) return [];
    return { error: "Las subtareas no son válidas" };
  }
  if (!Array.isArray(value)) return { error: "Las subtareas no son válidas" };
  if (value.length > SUBTASK_MAX) {
    return { error: `No podés tener más de ${SUBTASK_MAX} subtareas` };
  }
  const used = new Set<string>();
  const subtasks: ErpEntregableSubtask[] = [];
  for (const row of value) {
    if (!isRecord(row)) return { error: "Las subtareas no son válidas" };
    const title = parseTitle(row.title);
    if (isError(title)) return { error: title.error };
    if (typeof row.done !== "boolean") return { error: "El estado de la subtarea no es válido" };
    const dueOn = parseDueOn(row.dueOn);
    if (isError(dueOn)) return { error: dueOn.error };
    let id = parseSubtaskId(row.id);
    if (used.has(id)) id = crypto.randomUUID();
    used.add(id);
    subtasks.push({
      id,
      title,
      done: row.done,
      dueOn,
      createdAt: parseSubtaskCreatedAt(row.createdAt),
    });
  }
  return subtasks;
}

function isError(value: unknown): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

export function parseEntregableBlockInput(
  body: unknown,
  mode: "create" | "patch",
): { ok: true; value: Partial<ErpEntregableBlockInput> } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "Cuerpo inválido" };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const value: Partial<ErpEntregableBlockInput> = {};

  if (mode === "create" || has("name")) {
    const name = parseName(body.name);
    if (isError(name)) return { ok: false, error: name.error };
    value.name = name;
  }

  if (mode === "patch" && Object.keys(value).length === 0) {
    return { ok: false, error: "Nada que actualizar" };
  }
  return { ok: true, value };
}

export function parseBlockOrder(
  body: unknown,
): { ok: true; ids: string[] } | { ok: false; error: string } {
  if (!isRecord(body) || !Array.isArray(body.ids)) {
    return { ok: false, error: "El orden no es válido" };
  }
  if (body.ids.length === 0 || body.ids.length > BLOCK_ORDER_MAX) {
    return { ok: false, error: "El orden no es válido" };
  }
  const ids: string[] = [];
  const used = new Set<string>();
  for (const id of body.ids) {
    if (typeof id !== "string") return { ok: false, error: "El orden no es válido" };
    const value = id.trim();
    if (!value || used.has(value)) return { ok: false, error: "El orden no es válido" };
    used.add(value);
    ids.push(value);
  }
  return { ok: true, ids };
}

export function parseEntregableInput(
  body: unknown,
  mode: "create" | "patch",
): { ok: true; value: Partial<ErpEntregableInput> } | { ok: false; error: string } {
  if (!isRecord(body)) return { ok: false, error: "Cuerpo inválido" };
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const value: Partial<ErpEntregableInput> = {};

  if (mode === "create" || has("blockId")) {
    const blockId = String(body.blockId ?? "").trim();
    if (!blockId) return { ok: false, error: "El bloque es requerido" };
    value.blockId = blockId;
  }

  if (mode === "create" || has("title")) {
    const title = parseTitle(body.title);
    if (isError(title)) return { ok: false, error: title.error };
    value.title = title;
  }

  if (mode === "create" || has("description")) {
    const description = parseDescription(body.description);
    if (isError(description)) return { ok: false, error: description.error };
    value.description = description;
  }

  if (mode === "create" || has("dueOn")) {
    const dueOn = parseDueOn(body.dueOn);
    if (isError(dueOn)) return { ok: false, error: dueOn.error };
    value.dueOn = dueOn;
  }

  if (mode === "create" || has("dayPart")) {
    const dayPart = parseDayPart(body.dayPart);
    if (isError(dayPart)) return { ok: false, error: dayPart.error };
    value.dayPart = dayPart;
  }

  if (mode === "create" || has("status")) {
    if (mode === "create" && (body.status === undefined || body.status === "")) {
      value.status = "pending";
    } else {
      const status = parseStatus(body.status);
      if (isError(status)) return { ok: false, error: status.error };
      value.status = status;
    }
  }

  if (mode === "create" || has("subtasks")) {
    const subtasks = parseSubtasks(body.subtasks, mode === "create" && !has("subtasks"));
    if (isError(subtasks)) return { ok: false, error: subtasks.error };
    value.subtasks = subtasks;
  }

  if (mode === "patch" && Object.keys(value).length === 0) {
    return { ok: false, error: "Nada que actualizar" };
  }
  return { ok: true, value };
}

export function sortEntregables(items: ErpEntregable[]): ErpEntregable[] {
  return [...items].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;
    if (a.status === "done") return b.updatedAt.localeCompare(a.updatedAt);
    if (a.dueOn && b.dueOn) {
      const byDate = a.dueOn.localeCompare(b.dueOn);
      if (byDate !== 0) return byDate;
      const dayRank = (part: EntregableDayPart | null) =>
        part === "morning" ? 0 : part === "afternoon" ? 1 : part === "night" ? 2 : 3;
      const byPart = dayRank(a.dayPart) - dayRank(b.dayPart);
      if (byPart !== 0) return byPart;
    } else if (a.dueOn && !b.dueOn) {
      return -1;
    } else if (!a.dueOn && b.dueOn) {
      return 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}
