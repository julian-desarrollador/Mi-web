import { getMongoClient } from "@/app/lib/mongoClient";
import type { Filter } from "mongodb";

export type CobroDoc = {
  _id?: string;
  /** Alias conveniente del _id como string */
  id?: string;
  clientName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  paid: boolean;
  paidAt?: string; // YYYY-MM-DD — cuándo se marcó pagada en el panel
  /** Fecha real del cobro (ingreso contable), YYYY-MM-DD */
  fechaCobro?: string;
  servicio?: string;
  /** Texto libre en Cuotas del día; si no hay, se usa «cliente - Cuota» */
  descripcionCuota?: string;
  notes?: string;
  origen?: "manual" | "suscripcion_mp";
  estadisticasEnviadas?: boolean;
  /** Fecha en que se enviaron las estadísticas, YYYY-MM-DD */
  fechaEnvioEstadisticas?: string;
  recordatorioEnviado?: boolean;
  /** Si esta cuota requiere envío de estadísticas (independiente por mes) */
  requiereEstadisticas?: boolean;
  /** ID del ingreso auto-generado al marcar pagado */
  accountingRecordId?: string;
  /** Cuota de chamba: no entra en los totales de negocio salvo que se active el botón */
  chamba?: boolean;
  /** Prioridad manual para cola de cambios (0 = más urgente) */
  prioridad?: number;
  /** Cambio pendiente de esta cuota (ciclo mensual) */
  cambioPendiente?: boolean;
  /** Tareas del cambio asociadas a esta cuota */
  solicitudTasks?: { id: string; text: string; done: boolean; createdAt?: string; fueraColaActiva?: boolean; fechaRealizada?: string }[];
  createdAt: Date;
};

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

const COLLECTION = "cobros";

export async function insertCobro(
  doc: Omit<CobroDoc, "createdAt" | "_id">
): Promise<string> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<CobroDoc>(COLLECTION);
  const now = new Date();
  const result = await col.insertOne({
    ...doc,
    createdAt: now,
  });
  return result.insertedId!.toString();
}

export async function insertCobrosBulk(
  docs: Omit<CobroDoc, "createdAt" | "_id">[]
): Promise<string[]> {
  if (docs.length === 0) return [];
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<CobroDoc>(COLLECTION);
  const now = new Date();
  const toInsert = docs.map((d) => ({ ...d, createdAt: now }));
  const result = await col.insertMany(toInsert);
  return Object.values(result.insertedIds).map((id) => id.toString());
}

export async function getCobroById(id: string): Promise<CobroDoc | null> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const doc = await col.findOne({ _id: new ObjectId(id) }) as CobroDoc | null;
  if (!doc) return null;
  const docId = doc._id?.toString() ?? "";
  return {
    ...doc,
    _id: docId,
    id: docId,
    origen: doc.origen === "suscripcion_mp" ? "suscripcion_mp" : "manual",
    createdAt: doc.createdAt,
  };
}

export async function listCobros(limit = 1000): Promise<CobroDoc[]> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<CobroDoc>(COLLECTION);
  const docs = await col
    .find({})
    .sort({ dueDate: 1, createdAt: 1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => {
    const id = d._id?.toString() ?? "";
    return {
      ...d,
      _id: id,
      id,
      origen: d.origen === "suscripcion_mp" ? "suscripcion_mp" : "manual",
      createdAt: d.createdAt,
    };
  });
}

function escapeRegex(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Lista cobros por nombre(s) de cliente (match exacto case-insensitive).
 * Útil para el historial del cliente.
 */
export async function listCobrosByClientNames(
  clientNames: string[],
  limit = 500
): Promise<CobroDoc[]> {
  const normalized = Array.from(
    new Set(
      (clientNames || [])
        .map((n) => String(n || "").trim())
        .filter(Boolean)
    )
  );
  if (normalized.length === 0) return [];

  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<CobroDoc>(COLLECTION);

  const regexes = normalized.map(
    (n) => new RegExp(`^${escapeRegex(n)}$`, "i")
  );

  const query =
    regexes.length === 1
      ? { clientName: { $regex: regexes[0] } }
      : { $or: regexes.map((r) => ({ clientName: { $regex: r } })) };

  const docs = await col
    .find(query as Filter<CobroDoc>)
    .sort({ dueDate: -1, createdAt: -1 })
    .limit(limit)
    .toArray();

  return docs.map((d) => {
    const id = d._id?.toString() ?? "";
    return { ...d, _id: id, id, createdAt: d.createdAt };
  });
}

export async function setCobrosChambaByAccountingRecordId(
  accountingRecordId: string,
  chamba: boolean,
): Promise<void> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  await col.updateMany({ accountingRecordId }, { $set: { chamba } });
}

export async function updateCobro(
  id: string,
  doc: Partial<Omit<CobroDoc, "_id" | "createdAt">>,
  unsetFields?: string[]
): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const setDoc = { ...doc };
  if (unsetFields) {
    unsetFields.forEach((f) => delete setDoc[f as keyof typeof setDoc]);
  }
  const updateOp: Record<string, unknown> = {};
  if (Object.keys(setDoc).length > 0) updateOp.$set = setDoc;
  if (unsetFields && unsetFields.length > 0) {
    updateOp.$unset = Object.fromEntries(unsetFields.map((f) => [f, ""]));
  }
  if (Object.keys(updateOp).length === 0) return false;
  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    updateOp
  );
  return result.modifiedCount > 0;
}

export async function updateCobrosByClient(
  clientName: string,
  dueDateAfter: string,
  updates: Partial<Pick<CobroDoc, "amount">>
): Promise<number> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.updateMany(
    {
      clientName,
      dueDate: { $gt: dueDateAfter },
      paid: false,
    },
    { $set: updates }
  );
  return result.modifiedCount;
}

export async function deleteCobro(id: string): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}

export async function deleteCobrosByClient(clientName: string): Promise<number> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.deleteMany({ clientName });
  return result.deletedCount;
}
