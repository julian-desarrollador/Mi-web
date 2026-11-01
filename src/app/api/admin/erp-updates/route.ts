import { NextRequest, NextResponse } from "next/server";
import { insertErpUpdate, listErpUpdates } from "@/app/lib/erpUpdatesMongo";
import { localYmd, parseUpdateFechas } from "@/app/admin92/erp/lib/erpUpdates";

export const runtime = "nodejs";

/** GET: listar updates listas para entregar */
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const updates = await listErpUpdates();
    return NextResponse.json({ updates });
  } catch (e) {
    console.error("[admin:erp-updates] list failed", e);
    return NextResponse.json({ error: "No se pudieron cargar las updates" }, { status: 500 });
  }
}

/** POST: crear update { proyecto, nota, listaFecha, listaHora?, entregaFecha?, entregaHora? } */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body = await req.json();
    const proyecto = String(body.proyecto ?? "").trim();
    const nota = String(body.nota ?? "").trim();
    if (!proyecto) {
      return NextResponse.json({ error: "El proyecto es requerido" }, { status: 400 });
    }
    if (!nota) {
      return NextResponse.json({ error: "La nota del update es requerida" }, { status: 400 });
    }
    const { set, error } = parseUpdateFechas({ listaFecha: localYmd(), ...body });
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    const id = await insertErpUpdate({ proyecto, nota, ...set });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin:erp-updates] insert failed", e);
    return NextResponse.json({ error: "No se pudo guardar la update" }, { status: 500 });
  }
}
