import { NextRequest, NextResponse } from "next/server";
import {
  isMonthKey,
  isYmd,
  listCalendarioNotas,
  upsertCalendarioNota,
} from "@/app/lib/calendarioNotasMongo";

export const runtime = "nodejs";

/** GET: notas del mes (?month=YYYY-MM) */
export async function GET(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const month = req.nextUrl.searchParams.get("month") || "";
    if (!isMonthKey(month)) {
      return NextResponse.json({ error: "Mes requerido (YYYY-MM)" }, { status: 400 });
    }
    const notes = await listCalendarioNotas(month);
    return NextResponse.json({ notes });
  } catch (e) {
    console.error("[admin:calendario-notas] list failed", e);
    return NextResponse.json({ error: "No se pudieron cargar las notas" }, { status: 500 });
  }
}

/** PUT: guardar o borrar la nota de un día */
export async function PUT(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body = await req.json();
    const date = String(body.date || "").trim();
    if (!isYmd(date)) {
      return NextResponse.json({ error: "Fecha requerida (YYYY-MM-DD)" }, { status: 400 });
    }
    const text = await upsertCalendarioNota(date, body.text);
    return NextResponse.json({ ok: true, date, text });
  } catch (e) {
    console.error("[admin:calendario-notas] upsert failed", e);
    return NextResponse.json({ error: "No se pudo guardar la nota" }, { status: 500 });
  }
}
