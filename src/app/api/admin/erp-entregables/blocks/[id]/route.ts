import { NextRequest, NextResponse } from "next/server";
import { parseEntregableBlockInput } from "@/app/admin92/erp/lib/erpEntregables";
import {
  deleteEntregableBlock,
  updateEntregableBlock,
} from "@/app/lib/erpEntregablesMongo";

export const runtime = "nodejs";

function mongoGuard() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
  }
  return null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = mongoGuard();
    if (blocked) return blocked;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const body: unknown = await req.json();
    const parsed = parseEntregableBlockInput(body, "patch");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const block = await updateEntregableBlock(id, parsed.value);
    if (!block) {
      return NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, block });
  } catch (error) {
    console.error("[admin:erp-entregables] update block failed", error);
    return NextResponse.json({ error: "No se pudo actualizar el bloque" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const blocked = mongoGuard();
    if (blocked) return blocked;
    const { id } = await params;
    if (!id) return NextResponse.json({ error: "ID requerido" }, { status: 400 });

    const ok = await deleteEntregableBlock(id);
    if (!ok) {
      return NextResponse.json({ error: "Bloque no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin:erp-entregables] delete block failed", error);
    return NextResponse.json({ error: "No se pudo eliminar el bloque" }, { status: 500 });
  }
}
