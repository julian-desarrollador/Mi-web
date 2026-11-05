import { NextRequest, NextResponse } from "next/server";
import { insertMejoraGeneral, listMejorasGenerales } from "@/app/lib/mejorasGeneralesMongo";

export const runtime = "nodejs";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** GET: listar mejoras generales */
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const mejoras = await listMejorasGenerales();
    return NextResponse.json({ mejoras });
  } catch (e) {
    console.error("[admin:mejoras-generales] list failed", e);
    return NextResponse.json({ error: "No se pudieron cargar las mejoras generales" }, { status: 500 });
  }
}

/** POST: crear una mejora general (un texto, todavía sin aplicaciones) */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body = await req.json();
    const trimmed = String(body.text || "").trim();
    if (!trimmed) {
      return NextResponse.json({ error: "El texto es requerido" }, { status: 400 });
    }
    const createdAt =
      typeof body.createdAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.createdAt)
        ? body.createdAt
        : todayYmd();
    const id = await insertMejoraGeneral({
      text: trimmed,
      createdAt,
      aplicaciones: [],
    });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin:mejoras-generales] insert failed", e);
    return NextResponse.json({ error: "No se pudo guardar la mejora general" }, { status: 500 });
  }
}
