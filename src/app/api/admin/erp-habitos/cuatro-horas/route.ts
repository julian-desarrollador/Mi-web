import { NextRequest, NextResponse } from "next/server";
import {
  deleteCuatroHorasMark,
  listCuatroHorasMarks,
  upsertCuatroHorasMark,
} from "@/app/lib/erpHabitosMongo";
import { parseCuatroHorasMark } from "@/app/admin92/erp/lib/erpHabitos";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const marks = await listCuatroHorasMarks();
    return NextResponse.json({ marks });
  } catch (error) {
    console.error("[admin:erp-habitos] 4hs list failed", error);
    return NextResponse.json({ error: "No se pudo cargar el historial" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body: unknown = await req.json();
    const parsed = parseCuatroHorasMark(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const mark = await upsertCuatroHorasMark(parsed.value);
    return NextResponse.json({ ok: true, mark });
  } catch (error) {
    console.error("[admin:erp-habitos] 4hs upsert failed", error);
    return NextResponse.json({ error: "No se pudo guardar el día" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const date = req.nextUrl.searchParams.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "Fecha requerida (YYYY-MM-DD)" }, { status: 400 });
    }
    await deleteCuatroHorasMark(date);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin:erp-habitos] 4hs delete failed", error);
    return NextResponse.json({ error: "No se pudo quitar el día" }, { status: 500 });
  }
}
