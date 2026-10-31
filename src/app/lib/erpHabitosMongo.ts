import { ObjectId, type Document, type Filter, type WithId } from "mongodb";
import { getMongoClient } from "@/app/lib/mongoClient";
import {
  HABITOS_INICIALES,
  type CuatroHorasMark,
  type ErpHabito,
  parseMoodScore,
  type ErpMood,
  type MoodPatch,
  type MoodStartInput,
} from "@/app/admin92/erp/lib/erpHabitos";

const COLLECTION = "erp_habitos";
const MARKS_COLLECTION = "erp_habito_4hs";
const MOODS_COLLECTION = "erp_moods";
let indexPromise: Promise<string> | null = null;
let marksIndexPromise: Promise<string> | null = null;
let moodsIndexPromise: Promise<string> | null = null;

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
  const collection = client.db(getDbName()).collection<Document>(COLLECTION);
  if (!indexPromise) {
    indexPromise = collection.createIndex({ order: 1 });
  }
  await indexPromise;
  return collection;
}

function toHabito(doc: WithId<Document>): ErpHabito | null {
  if (!(doc._id instanceof ObjectId) || typeof doc.text !== "string") return null;
  return {
    _id: doc._id.toString(),
    text: doc.text,
    order: typeof doc.order === "number" ? doc.order : 0,
  };
}

const seedFilter = { _id: "seed" } as unknown as Filter<Document>;

async function ensureSeed() {
  const collection = await getCollection();
  const habits = await collection.countDocuments({ text: { $exists: true } });
  const seed = await collection.findOne(seedFilter);
  if (seed?.ready === true) return;
  if (habits > 0) {
    await collection.updateOne(seedFilter, { $set: { seeded: true, ready: true } }, { upsert: true });
    return;
  }

  const marker = await collection.updateOne(
    seedFilter,
    { $setOnInsert: { seeded: true, ready: false } },
    { upsert: true },
  );
  if (marker.upsertedCount === 1) {
    const now = new Date();
    await collection.insertMany(
      HABITOS_INICIALES.map((text, order) => ({
        text,
        order,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await collection.updateOne(seedFilter, { $set: { ready: true } });
    return;
  }

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const current = await collection.findOne(seedFilter);
    if (current?.ready === true) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export async function listErpHabitos(): Promise<ErpHabito[]> {
  await ensureSeed();
  const collection = await getCollection();
  const docs = await collection.find({ text: { $exists: true } }).sort({ order: 1 }).limit(200).toArray();
  return docs.flatMap((doc) => {
    const habito = toHabito(doc);
    return habito ? [habito] : [];
  });
}

export async function insertErpHabito(text: string): Promise<ErpHabito> {
  await ensureSeed();
  const collection = await getCollection();
  const last = await collection.find({ text: { $exists: true } }).sort({ order: -1 }).limit(1).toArray();
  const previous = last[0] ? toHabito(last[0]) : null;
  const order = previous ? previous.order + 1 : 0;
  const now = new Date();
  const result = await collection.insertOne({
    text,
    order,
    createdAt: now,
    updatedAt: now,
  });
  return { _id: result.insertedId.toString(), text, order };
}

export async function updateErpHabito(id: string, text: string): Promise<ErpHabito | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getCollection();
  const result = await collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { text, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) return null;
  return toHabito(result);
}

export async function deleteErpHabito(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

async function getMarksCollection() {
  const client = await getMongoClient();
  const collection = client.db(getDbName()).collection<Document>(MARKS_COLLECTION);
  if (!marksIndexPromise) {
    marksIndexPromise = collection.createIndex({ date: 1 }, { unique: true });
  }
  await marksIndexPromise;
  return collection;
}

function toMark(doc: WithId<Document>): CuatroHorasMark | null {
  if (typeof doc.date !== "string") return null;
  const fulfilled = typeof doc.fulfilled === "boolean" ? doc.fulfilled : null;
  const note = typeof doc.note === "string" ? doc.note : "";
  if (fulfilled === null && !note.trim()) return null;
  return { date: doc.date, fulfilled, note };
}

export async function listCuatroHorasMarks(): Promise<CuatroHorasMark[]> {
  const collection = await getMarksCollection();
  const docs = await collection.find({}).sort({ date: -1 }).limit(400).toArray();
  return docs.flatMap((doc) => {
    const mark = toMark(doc);
    return mark ? [mark] : [];
  });
}

export async function upsertCuatroHorasMark(mark: CuatroHorasMark): Promise<CuatroHorasMark> {
  const collection = await getMarksCollection();
  const note = mark.note.trim();
  const saved: CuatroHorasMark = { date: mark.date, fulfilled: mark.fulfilled, note };
  if (saved.fulfilled === null && !note) {
    await collection.deleteOne({ date: mark.date });
    return saved;
  }
  await collection.updateOne(
    { date: mark.date },
    { $set: { date: mark.date, fulfilled: saved.fulfilled, note, updatedAt: new Date() } },
    { upsert: true },
  );
  return saved;
}

export async function deleteCuatroHorasMark(date: string): Promise<void> {
  const collection = await getMarksCollection();
  await collection.deleteOne({ date });
}

function clockMinutes(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

async function getMoodsCollection() {
  const client = await getMongoClient();
  const collection = client.db(getDbName()).collection<Document>(MOODS_COLLECTION);
  if (!moodsIndexPromise) {
    moodsIndexPromise = collection.createIndex({ date: -1, startedAt: 1 });
  }
  await moodsIndexPromise;
  return collection;
}

function toMood(doc: WithId<Document>): ErpMood | null {
  if (!(doc._id instanceof ObjectId)) return null;
  if (typeof doc.date !== "string" || typeof doc.mood !== "string" || typeof doc.startedAt !== "string") {
    return null;
  }
  return {
    _id: doc._id.toString(),
    date: doc.date,
    mood: doc.mood,
    startedAt: doc.startedAt,
    endedAt: typeof doc.endedAt === "string" ? doc.endedAt : null,
    score: parseMoodScore(doc.score),
    note: typeof doc.note === "string" ? doc.note : "",
  };
}

export async function listErpMoods(): Promise<ErpMood[]> {
  const collection = await getMoodsCollection();
  const docs = await collection.find({}).limit(400).toArray();
  return docs
    .flatMap((doc) => {
      const mood = toMood(doc);
      return mood ? [mood] : [];
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return clockMinutes(a.startedAt) - clockMinutes(b.startedAt);
    });
}

export async function findOpenErpMood(date: string): Promise<ErpMood | null> {
  const collection = await getMoodsCollection();
  const doc = await collection.findOne({ date, endedAt: null });
  return doc ? toMood(doc) : null;
}

export async function insertErpMood(input: MoodStartInput): Promise<ErpMood> {
  const collection = await getMoodsCollection();
  const now = new Date();
  const result = await collection.insertOne({
    date: input.date,
    mood: input.mood,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    score: input.score,
    note: input.note,
    createdAt: now,
    updatedAt: now,
  });
  return {
    _id: result.insertedId.toString(),
    date: input.date,
    mood: input.mood,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    score: input.score,
    note: input.note,
  };
}

/**
 * Con `endedAt`: cierra el mood (solo si está abierto) y aplica el patch.
 * Sin `endedAt`: edita mood/score/note de cualquier mood.
 */
export async function pauseErpMood(
  id: string,
  endedAt: string | null,
  patch: MoodPatch = {},
): Promise<ErpMood | null> {
  if (!ObjectId.isValid(id)) return null;
  const collection = await getMoodsCollection();
  const filter: Document = { _id: new ObjectId(id) };
  if (endedAt) filter.endedAt = null;
  const result = await collection.findOneAndUpdate(
    filter,
    { $set: { ...patch, ...(endedAt ? { endedAt } : {}), updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return result ? toMood(result) : null;
}

export async function deleteErpMood(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const collection = await getMoodsCollection();
  const result = await collection.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
