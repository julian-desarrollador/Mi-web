import { getMongoClient } from "@/app/lib/mongoClient";
import { CALENDARIO_NOTA_MAX } from "@/app/admin92/contabilidad/lib/calendarioNotas";

export type CalendarioNotaDoc = {
  _id?: string;
  date: string;
  text: string;
  updatedAt: Date;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const COLLECTION = "contabilidad_calendario_notas";
let indexPromise: Promise<string> | null = null;

function getDbName() {
  const uri = process.env.MONGODB_URI || "";
  try {
    const u = new URL(uri);
    const p = u.pathname?.replace(/^\//, "");
    return p || process.env.MONGODB_DB || "glomun-panel";
  } catch {
    return process.env.MONGODB_DB || "glomun-panel";
  }
}

async function getCollection() {
  const client = await getMongoClient();
  const collection = client.db(getDbName()).collection<CalendarioNotaDoc>(COLLECTION);
  if (!indexPromise) {
    indexPromise = collection.createIndex({ date: 1 }, { unique: true });
  }
  await indexPromise;
  return collection;
}

export function isYmd(value: string): boolean {
  return DATE_RE.test(value);
}

export function isMonthKey(value: string): boolean {
  return MONTH_RE.test(value);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Mes visible más hasta 6 días de relleno del calendario. */
export function monthNoteRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const from = new Date(y, m - 1, 1 - 6);
  const to = new Date(y, m, 6);
  return { from: toYmd(from), to: toYmd(to) };
}

export function normalizeNotaText(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .slice(0, CALENDARIO_NOTA_MAX);
}

export async function listCalendarioNotas(
  month: string,
): Promise<Record<string, string>> {
  const collection = await getCollection();
  const { from, to } = monthNoteRange(month);
  const docs = await collection
    .find({ date: { $gte: from, $lte: to } })
    .limit(50)
    .toArray();
  const notes: Record<string, string> = {};
  for (const doc of docs) {
    const text = String(doc.text ?? "").trim();
    if (text) notes[doc.date] = text.slice(0, CALENDARIO_NOTA_MAX);
  }
  return notes;
}

/** Texto vacío borra la nota de ese día. */
export async function upsertCalendarioNota(
  date: string,
  text: string,
): Promise<string> {
  const collection = await getCollection();
  const trimmed = normalizeNotaText(text);
  if (!trimmed) {
    await collection.deleteOne({ date });
    return "";
  }
  await collection.updateOne(
    { date },
    { $set: { date, text: trimmed, updatedAt: new Date() } },
    { upsert: true },
  );
  return trimmed;
}
