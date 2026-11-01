import { getMongoClient } from "@/app/lib/mongoClient";

export type Desarrollo50SolicitudTask = {
  id: string;
  text: string;
  done: boolean;
  createdAt?: string;
  fueraColaActiva?: boolean;
  fechaRealizada?: string;
};

export type Desarrollo50Prueba = "14d" | "1m";

export type Desarrollo50Doc = {
  _id?: string;
  clientName: string;
  name: string;
  servicio?: string;
  /** Fecha del 1.er 50%; vacío si el lead todavía no pagó (p. ej. prueba gratis SaaS) */
  fechaCobro50?: string;
  montoCobrado50?: number;
  accountingRecordId?: string;
  fechaCobro50Final?: string;
  montoCobrado50Final?: number;
  accountingRecordIdFinal?: string;
  activo: boolean;
  /** Cambio pendiente (borde ámbar en calendario), igual que cuotas */
  cambioPendiente?: boolean;
  /** Tareas operativas del desarrollo (misma shape que cuotas) */
  solicitudTasks?: Desarrollo50SolicitudTask[];
  /** Lead: teléfono / WhatsApp */
  telefono?: string;
  /** Lead: de dónde vino (texto libre) */
  origen?: string;
  /** Lead: prueba gratis del SaaS */
  prueba?: Desarrollo50Prueba;
  /** Lead: inicio de la prueba gratis (YYYY-MM-DD) */
  pruebaInicio?: string;
  createdAt?: Date;
  updatedAt?: Date;
};

const COLLECTION = "desarrollos_50";

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

export async function listDesarrollos50Activos(): Promise<Desarrollo50Doc[]> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<Desarrollo50Doc>(COLLECTION);
  const docs = await col
    .find({ activo: { $ne: false } })
    .sort({ fechaCobro50: -1, createdAt: -1 })
    .limit(100)
    .toArray();
  return docs.map((d) => ({
    ...d,
    _id: d._id?.toString(),
  }));
}

export async function insertDesarrollo50(
  doc: Omit<Desarrollo50Doc, "_id" | "createdAt" | "updatedAt">,
): Promise<string> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<Desarrollo50Doc>(COLLECTION);
  const now = new Date();
  const result = await col.insertOne({
    ...doc,
    activo: doc.activo !== false,
    createdAt: now,
    updatedAt: now,
  });
  return result.insertedId.toString();
}

export async function getDesarrollo50ById(id: string): Promise<Desarrollo50Doc | null> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const doc = (await col.findOne({ _id: new ObjectId(id) })) as Desarrollo50Doc | null;
  if (!doc) return null;
  return { ...doc, _id: doc._id?.toString() };
}

export async function updateDesarrollo50(
  id: string,
  patch: Partial<
    Pick<
      Desarrollo50Doc,
      | "clientName"
      | "name"
      | "servicio"
      | "fechaCobro50"
      | "montoCobrado50"
      | "accountingRecordId"
      | "telefono"
      | "origen"
      | "prueba"
      | "pruebaInicio"
      | "fechaCobro50Final"
      | "montoCobrado50Final"
      | "accountingRecordIdFinal"
      | "activo"
      | "cambioPendiente"
      | "solicitudTasks"
    >
  >,
): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: { ...patch, updatedAt: new Date() } },
  );
  return result.matchedCount > 0;
}

export async function deleteDesarrollo50(id: string): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
