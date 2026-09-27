import { NextRequest, NextResponse } from "next/server";
import { parseEntregableInput } from "@/app/admin92/erp/lib/erpEntregables";
import { deleteEntregable, updateEntregable } from "@/app/lib/erpEntregablesMongo";

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
    const parsed = parseEntregableInput(body, "patch");
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const item = await updateEntregable(id, parsed.value);
    if (!item) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, item });
  } catch (error) {
    console.error("[admin:erp-entregables] update failed", error);
    return NextResponse.json({ error: "No se pudo actualizar la tarea" }, { status: 500 });
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

    const ok = await deleteEntregable(id);
    if (!ok) {
      return NextResponse.json({ error: "Tarea no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin:erp-entregables] delete failed", error);
    return NextResponse.json({ error: "No se pudo eliminar la tarea" }, { status: 500 });
  }
}
