import { NextRequest, NextResponse } from "next/server";
import { deleteErpHabito, updateErpHabito } from "@/app/lib/erpHabitosMongo";
import { parseHabitoText } from "@/app/admin92/erp/lib/erpHabitos";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const body: unknown = await req.json();
    const text = body && typeof body === "object" ? (body as { text?: unknown }).text : "";
    const parsed = parseHabitoText(text);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const habito = await updateErpHabito(id, parsed.text);
    if (!habito) {
      return NextResponse.json({ error: "Hábito no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, habito });
  } catch (error) {
    console.error("[admin:erp-habitos] update failed", error);
    return NextResponse.json({ error: "No se pudo actualizar el hábito" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }
    const ok = await deleteErpHabito(id);
    if (!ok) {
      return NextResponse.json({ error: "Hábito no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin:erp-habitos] delete failed", error);
    return NextResponse.json({ error: "No se pudo eliminar el hábito" }, { status: 500 });
  }
}
