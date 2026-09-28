import { NextRequest, NextResponse } from "next/server";
import { parseEntregableInput } from "@/app/admin92/erp/lib/erpEntregables";
import { insertEntregable, listEntregableBlocks } from "@/app/lib/erpEntregablesMongo";

export const runtime = "nodejs";

function mongoGuard() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
  }
  return null;
}

export async function GET() {
  try {
    const blocked = mongoGuard();
    if (blocked) return blocked;
    const blocks = await listEntregableBlocks();
    return NextResponse.json({ blocks });
  } catch (error) {
    console.error("[admin:erp-entregables] list failed", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los entregables" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const blocked = mongoGuard();
    if (blocked) return blocked;
    const body: unknown = await req.json();
    const parsed = parseEntregableInput(body, "create");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { blockId, title, description, dueOn, dayPart, status, subtasks } = parsed.value;
    if (!blockId || !title || !status) {
      return NextResponse.json({ error: "Faltan datos de la tarea" }, { status: 400 });
    }
    const item = await insertEntregable({
      blockId,
      title,
      description: description ?? null,
      dueOn: dueOn ?? null,
      dayPart: dayPart ?? null,
      status,
      subtasks: subtasks ?? [],
    });
    if (!item) {
      return NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[admin:erp-entregables] create failed", error);
    return NextResponse.json({ error: "No se pudo crear la tarea" }, { status: 500 });
  }
}
