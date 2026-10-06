import { getMongoClient } from "@/app/lib/mongoClient";

export type AccountingType = "ingreso" | "gasto" | "inversion";

export type AccountingDoc = {
  _id?: string;
  type: AccountingType;
  amount: number;
  description: string;
  /** Categoría opcional (ej. para gastos: hosting, dominios) */
  category?: string;
  date: Date;
  createdAt: Date;
  /** Ingreso de chamba: no entra en los totales de negocio salvo que se active el botón */
  chamba?: boolean;
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

const COLLECTION = "accounting";

export async function insertAccountingRecord(
  doc: Omit<AccountingDoc, "createdAt" | "_id">
) {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<AccountingDoc>(COLLECTION);
  const now = new Date();
  const result = await col.insertOne({
    ...doc,
    createdAt: now,
  });
  return result.insertedId;
}

export async function listAccountingRecords(limit = 500): Promise<AccountingDoc[]> {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection<AccountingDoc>(COLLECTION);
  const docs = await col
    .find({})
    .sort({ date: -1, createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map((d) => ({
    ...d,
    _id: d._id?.toString(),
    date: d.date,
    createdAt: d.createdAt,
  }));
}

export async function updateAccountingRecord(
  id: string,
  doc: Partial<Omit<AccountingDoc, "_id" | "createdAt">>
) {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.updateOne(
    { _id: new ObjectId(id) },
    { $set: doc }
  );
  return result.modifiedCount > 0;
}

export async function deleteAccountingRecord(id: string) {
  const { ObjectId } = await import("mongodb");
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const col = db.collection(COLLECTION);
  const result = await col.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
