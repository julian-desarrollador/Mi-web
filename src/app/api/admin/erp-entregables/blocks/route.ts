import { NextRequest, NextResponse } from "next/server";
import { parseBlockOrder, parseEntregableBlockInput } from "@/app/admin92/erp/lib/erpEntregables";
import { insertEntregableBlock, reorderEntregableBlocks } from "@/app/lib/erpEntregablesMongo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body: unknown = await req.json();
    const parsed = parseEntregableBlockInput(body, "create");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const name = parsed.value.name;
    const area = parsed.value.area;
    const lane = parsed.value.lane;
    if (!name) {
      return NextResponse.json({ error: "El nombre del bloque es requerido" }, { status: 400 });
    }
    if (!area) {
      return NextResponse.json({ error: "El área es requerida" }, { status: 400 });
    }
    if (!lane) {
      return NextResponse.json({ error: "La fila es requerida" }, { status: 400 });
    }
    const block = await insertEntregableBlock({ name, area, lane });
    return NextResponse.json({ ok: true, block });
  } catch (error) {
    console.error("[admin:erp-entregables] create block failed", error);
    return NextResponse.json({ error: "No se pudo crear el bloque" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body: unknown = await req.json();
    const parsed = parseBlockOrder(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const blocks = await reorderEntregableBlocks(parsed.ids, parsed.area, parsed.lane);
    if (!blocks) {
      return NextResponse.json({ error: "El orden de los bloques no coincide" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, blocks });
  } catch (error) {
    console.error("[admin:erp-entregables] reorder blocks failed", error);
    return NextResponse.json({ error: "No se pudo guardar el orden de los bloques" }, { status: 500 });
  }
}
