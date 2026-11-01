import { getMongoClient } from "@/app/lib/mongoClient";

/** Update lista para entregar a un proyecto (ERP → timer live). */
export type ErpUpdateDoc = {
  _id?: string;
  proyecto: string;
  nota: string;
  /** Cuándo quedó lista (YYYY-MM-DD) + hora opcional (HH:mm) */
  listaFecha?: string;
  listaHora?: string;
  /** Entrega planeada + hora opcional */
  entregaFecha?: string;
  entregaHora?: string;
  /** Se cumplió la entrega (tildada) */
  entregada?: boolean;
  entregadaAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

type EditableField =
  | "proyecto"
  | "nota"
  | "listaFecha"
  | "listaHora"
  | "entregaFecha"
  | "entregaHora"
  | "entregada"
  | "entregadaAt";

const COLLECTION = "erp_updates";

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
  return client.db(getDbName()).collection<ErpUpdateDoc>(COLLECTION);
}

export async function listErpUpdates(): Promise<ErpUpdateDoc[]> {
  const col = await getCollection();
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(500).toArray();
  return docs.map((d) => ({ ...d, _id: d._id?.toString() }));
}

export async function insertErpUpdate(
  doc: Omit<ErpUpdateDoc, "_id" | "createdAt" | "updatedAt" | "entregada" | "entregadaAt">,
): Promise<string> {
  const col = await getCollection();
  const now = new Date();
  const result = await col.insertOne({ ...doc, entregada: false, createdAt: now, updatedAt: now });
  return result.insertedId.toString();
}

export async function updateErpUpdate(
  id: string,
  patch: Partial<Pick<ErpUpdateDoc, EditableField>>,
  unset: EditableField[] = [],
): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const col = client.db(getDbName()).collection(COLLECTION);
  const update: Record<string, unknown> = { $set: { ...patch, updatedAt: new Date() } };
  if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, ""]));
  const result = await col.updateOne({ _id: new ObjectId(id) }, update);
  return result.matchedCount > 0;
}

export async function deleteErpUpdate(id: string): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const col = client.db(getDbName()).collection(COLLECTION);
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
