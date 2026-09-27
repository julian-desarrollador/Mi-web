import { ObjectId, type WithId } from "mongodb";
import { getMongoClient } from "@/app/lib/mongoClient";
import {
  sortEntregables,
  type EntregableDayPart,
  type EntregableStatus,
  type ErpEntregable,
  type ErpEntregableBlock,
  type ErpEntregableBlockInput,
  type ErpEntregableInput,
} from "@/app/admin92/erp/lib/erpEntregables";

type BlockDoc = {
  _id?: ObjectId;
  name: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
};

type ItemDoc = {
  _id?: ObjectId;
  blockId: string;
  title: string;
  description: string | null;
  dueOn: string | null;
  dayPart: EntregableDayPart | null;
  status: EntregableStatus;
  createdAt: Date;
  updatedAt: Date;
};

const BLOCKS = "erp_entregable_blocks";
const ITEMS = "erp_entregables";
let indexPromise: Promise<unknown> | null = null;

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

async function getCollections() {
  const client = await getMongoClient();
  const db = client.db(getDbName());
  const blocks = db.collection<BlockDoc>(BLOCKS);
  const items = db.collection<ItemDoc>(ITEMS);
  if (!indexPromise) {
    indexPromise = Promise.all([
      blocks.createIndex({ order: 1, createdAt: 1 }),
      items.createIndex({ blockId: 1, status: 1, dueOn: 1 }),
    ]);
  }
  await indexPromise;
  return { blocks, items };
}

function toItem(doc: WithId<ItemDoc>): ErpEntregable {
  return {
    _id: doc._id.toString(),
    blockId: doc.blockId,
    title: doc.title,
    description: doc.description ?? null,
    dueOn: doc.dueOn ?? null,
    dayPart: doc.dayPart ?? null,
    status: doc.status,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function toBlock(doc: WithId<BlockDoc>, items: ErpEntregable[]): ErpEntregableBlock {
  return {
    _id: doc._id.toString(),
    name: doc.name,
    order: doc.order,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    items: sortEntregables(items),
  };
}

export async function listEntregableBlocks(): Promise<ErpEntregableBlock[]> {
  const { blocks, items } = await getCollections();
  const [blockDocs, itemDocs] = await Promise.all([
    blocks.find({}).sort({ order: 1, createdAt: 1 }).limit(100).toArray(),
    items.find({}).limit(1000).toArray(),
  ]);
  const byBlock = new Map<string, ErpEntregable[]>();
  for (const doc of itemDocs) {
    const item = toItem(doc);
    const list = byBlock.get(item.blockId) ?? [];
    list.push(item);
    byBlock.set(item.blockId, list);
  }
  return blockDocs.map((doc) => toBlock(doc, byBlock.get(doc._id.toString()) ?? []));
}

export async function insertEntregableBlock(
  input: ErpEntregableBlockInput,
): Promise<ErpEntregableBlock> {
  const { blocks } = await getCollections();
  const last = await blocks.find({}).sort({ order: -1 }).limit(1).next();
  const now = new Date();
  const doc: BlockDoc = {
    name: input.name,
    order: (last?.order ?? -1) + 1,
    createdAt: now,
    updatedAt: now,
  };
  const result = await blocks.insertOne(doc);
  return toBlock({ ...doc, _id: result.insertedId }, []);
}

export async function updateEntregableBlock(
  id: string,
  input: Partial<ErpEntregableBlockInput>,
): Promise<ErpEntregableBlock | null> {
  if (!ObjectId.isValid(id) || input.name === undefined) return null;
  const { blocks, items } = await getCollections();
  const result = await blocks.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { name: input.name, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) return null;
  const itemDocs = await items.find({ blockId: id }).toArray();
  return toBlock(result, itemDocs.map(toItem));
}

export async function deleteEntregableBlock(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const { blocks, items } = await getCollections();
  const result = await blocks.deleteOne({ _id: new ObjectId(id) });
  if (result.deletedCount === 0) return false;
  await items.deleteMany({ blockId: id });
  return true;
}

export async function insertEntregable(input: ErpEntregableInput): Promise<ErpEntregable | null> {
  if (!ObjectId.isValid(input.blockId)) return null;
  const { blocks, items } = await getCollections();
  const block = await blocks.findOne({ _id: new ObjectId(input.blockId) });
  if (!block) return null;
  const now = new Date();
  const doc: ItemDoc = {
    blockId: input.blockId,
    title: input.title,
    description: input.description,
    dueOn: input.dueOn,
    dayPart: input.dayPart,
    status: input.status,
    createdAt: now,
    updatedAt: now,
  };
  const result = await items.insertOne(doc);
  return toItem({ ...doc, _id: result.insertedId });
}

export async function updateEntregable(
  id: string,
  input: Partial<ErpEntregableInput>,
): Promise<ErpEntregable | null> {
  if (!ObjectId.isValid(id)) return null;
  const { blocks, items } = await getCollections();
  if (input.blockId !== undefined) {
    if (!ObjectId.isValid(input.blockId)) return null;
    const block = await blocks.findOne({ _id: new ObjectId(input.blockId) });
    if (!block) return null;
  }
  const updates: Partial<ItemDoc> = { updatedAt: new Date() };
  if (input.blockId !== undefined) updates.blockId = input.blockId;
  if (input.title !== undefined) updates.title = input.title;
  if (input.description !== undefined) updates.description = input.description;
  if (input.dueOn !== undefined) updates.dueOn = input.dueOn;
  if (input.dayPart !== undefined) updates.dayPart = input.dayPart;
  if (input.status !== undefined) updates.status = input.status;

  const result = await items.findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updates },
    { returnDocument: "after" },
  );
  if (!result) return null;
  return toItem(result);
}

export async function deleteEntregable(id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const { items } = await getCollections();
  const result = await items.deleteOne({ _id: new ObjectId(id) });
  return result.deletedCount > 0;
}
