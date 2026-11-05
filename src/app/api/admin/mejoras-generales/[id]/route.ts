import { NextRequest, NextResponse } from "next/server";
import {
  deleteMejoraGeneral,
  updateMejoraGeneral,
  type MejoraGeneralAplicacion,
} from "@/app/lib/mejorasGeneralesMongo";

export const runtime = "nodejs";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseAplicaciones(raw: unknown): MejoraGeneralAplicacion[] | null {
  if (!Array.isArray(raw)) return null;
  const seen = new Set<string>();
  const out: MejoraGeneralAplicacion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") return null;
    const row = item as Record<string, unknown>;
    const clientName = String(row.clientName || "").trim();
    if (!clientName) return null;
    const servicioRaw = typeof row.servicio === "string" ? row.servicio.trim() : "";
    const servicio = servicioRaw || undefined;
    const key = `${clientName.toLowerCase()}|${(servicio ?? "").toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const done = Boolean(row.done);
    let fechaRealizada: string | undefined;
    if (done && row.fechaRealizada) {
      const v = String(row.fechaRealizada);
      if (!YMD.test(v)) return null;
      fechaRealizada = v;
    }
    out.push({
      clientName,
      ...(servicio ? { servicio } : {}),
      done,
      ...(fechaRealizada ? { fechaRealizada } : {}),
    });
  }
  return out;
}

/** PATCH: cambiar el texto o la lista de aplicaciones */
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
    const body = await req.json();
    const patch: { text?: string; createdAt?: string; aplicaciones?: MejoraGeneralAplicacion[] } = {};

    if (body.text !== undefined) {
      const trimmed = String(body.text || "").trim();
      if (!trimmed) {
        return NextResponse.json({ error: "El texto es requerido" }, { status: 400 });
      }
      patch.text = trimmed;
    }
    if (body.createdAt !== undefined) {
      const v = String(body.createdAt);
      if (!YMD.test(v)) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });
      }
      patch.createdAt = v;
    }
    if (body.aplicaciones !== undefined) {
      const aplicaciones = parseAplicaciones(body.aplicaciones);
      if (!aplicaciones) {
        return NextResponse.json({ error: "Aplicaciones inválidas" }, { status: 400 });
      }
      patch.aplicaciones = aplicaciones;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const ok = await updateMejoraGeneral(id, patch);
    if (!ok) {
      return NextResponse.json({ error: "Mejora no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:mejoras-generales] update failed", e);
    return NextResponse.json({ error: "No se pudo actualizar la mejora general" }, { status: 500 });
  }
}

/** DELETE: eliminar la mejora general */
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
    const ok = await deleteMejoraGeneral(id);
    if (!ok) {
      return NextResponse.json({ error: "Mejora no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:mejoras-generales] delete failed", e);
    return NextResponse.json({ error: "No se pudo eliminar la mejora general" }, { status: 500 });
  }
}
