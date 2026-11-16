import { NextRequest, NextResponse } from "next/server";
import { getErpRutina, saveErpRutina } from "@/app/lib/erpRutinaMongo";
import { normalizeRutina, RUTINA_INICIAL } from "@/app/admin92/erp/lib/erpRutina";

export const runtime = "nodejs";

/** GET: la rutina guardada, o la inicial si todavía no hay ninguna */
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const pasos = await getErpRutina();
    return NextResponse.json({ pasos: pasos ?? RUTINA_INICIAL });
  } catch (e) {
    console.error("[admin:erp-rutina] get failed", e);
    return NextResponse.json({ error: "No se pudo cargar la rutina" }, { status: 500 });
  }
}

/** PUT: reemplaza la rutina completa { pasos: { id, text }[] } */
export async function PUT(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body = await req.json();
    const pasos = normalizeRutina(body?.pasos);
    if (!pasos) {
      return NextResponse.json({ error: "pasos debe ser una lista" }, { status: 400 });
    }
    await saveErpRutina(pasos);
    return NextResponse.json({ ok: true, pasos });
  } catch (e) {
    console.error("[admin:erp-rutina] save failed", e);
    return NextResponse.json({ error: "No se pudo guardar la rutina" }, { status: 500 });
  }
}
