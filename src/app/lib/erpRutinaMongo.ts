import { getMongoClient } from "@/app/lib/mongoClient";
import type { RutinaPaso } from "@/app/admin92/erp/lib/erpRutina";

/** Rutina diaria del ERP: un único documento con la lista completa. */
type ErpRutinaDoc = {
  _id: string;
  pasos: RutinaPaso[];
  updatedAt: Date;
};

const COLLECTION = "erp_rutina";
const DOC_ID = "rutina";

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
  return client.db(getDbName()).collection<ErpRutinaDoc>(COLLECTION);
}

/** Null si todavía no se guardó ninguna rutina. */
export async function getErpRutina(): Promise<RutinaPaso[] | null> {
  const col = await getCollection();
  const doc = await col.findOne({ _id: DOC_ID });
  return doc ? doc.pasos : null;
}

export async function saveErpRutina(pasos: RutinaPaso[]): Promise<void> {
  const col = await getCollection();
  await col.updateOne(
    { _id: DOC_ID },
    { $set: { pasos, updatedAt: new Date() } },
    { upsert: true },
  );
}
