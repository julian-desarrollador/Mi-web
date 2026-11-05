import { getMongoClient } from "@/app/lib/mongoClient";

export type MejoraGeneralAplicacion = {
  clientName: string;
  servicio?: string;
  done: boolean;
  fechaRealizada?: string;
};

export type MejoraGeneralDoc = {
  _id?: string;
  text: string;
  /** Fecha en que se anotó, YYYY-MM-DD */
  createdAt: string;
  aplicaciones: MejoraGeneralAplicacion[];
  updatedAt?: Date;
};

const COLLECTION = "mejoras_generales";

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

export async function listMejorasGenerales(): Promise<MejoraGeneralDoc[]> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<MejoraGeneralDoc>(COLLECTION);
  const docs = await col.find({}).sort({ createdAt: -1 }).limit(500).toArray();
  return docs.map((d) => ({
    ...d,
    _id: d._id?.toString(),
    aplicaciones: d.aplicaciones ?? [],
  }));
}

export async function insertMejoraGeneral(
  doc: Omit<MejoraGeneralDoc, "_id" | "updatedAt">,
): Promise<string> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<MejoraGeneralDoc>(COLLECTION);
  const result = await col.insertOne({
    ...doc,
    aplicaciones: doc.aplicaciones ?? [],
    updatedAt: new Date(),
  });
  return result.insertedId.toString();
}

export async function updateMejoraGeneral(
  id: string,
  patch: Partial<Pick<MejoraGeneralDoc, "text" | "createdAt" | "aplicaciones">>,
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

export async function deleteMejoraGeneral(id: string): Promise<boolean> {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
