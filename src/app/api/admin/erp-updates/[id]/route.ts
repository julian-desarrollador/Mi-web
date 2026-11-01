import { NextRequest, NextResponse } from "next/server";
import { deleteErpUpdate, updateErpUpdate, type ErpUpdateDoc } from "@/app/lib/erpUpdatesMongo";
import { parseUpdateFechas } from "@/app/admin92/erp/lib/erpUpdates";

export const runtime = "nodejs";

/** PATCH: editar proyecto, nota, fechas y/o marcar entregada */
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
    const patch: Partial<ErpUpdateDoc> = {};
    if (body.proyecto !== undefined) {
      const v = String(body.proyecto ?? "").trim();
      if (!v) return NextResponse.json({ error: "El proyecto es requerido" }, { status: 400 });
      patch.proyecto = v;
    }
    if (body.nota !== undefined) {
      const v = String(body.nota ?? "").trim();
      if (!v) return NextResponse.json({ error: "La nota del update es requerida" }, { status: 400 });
      patch.nota = v;
    }
    const { set, unset, error } = parseUpdateFechas(body);
    if (error) {
      return NextResponse.json({ error }, { status: 400 });
    }
    Object.assign(patch, set);
    const unsetKeys: Parameters<typeof updateErpUpdate>[2] = [...unset];
    if (body.entregada !== undefined) {
      patch.entregada = Boolean(body.entregada);
      if (patch.entregada) patch.entregadaAt = new Date();
      else unsetKeys.push("entregadaAt");
    }
    if (Object.keys(patch).length === 0 && unsetKeys.length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }
    const ok = await updateErpUpdate(id, patch, unsetKeys);
    if (!ok) {
      return NextResponse.json({ error: "Update no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:erp-updates] update failed", e);
    return NextResponse.json({ error: "No se pudo actualizar la update" }, { status: 500 });
  }
}

/** DELETE: quitar update (p. ej. ya entregada) */
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
    const ok = await deleteErpUpdate(id);
    if (!ok) {
      return NextResponse.json({ error: "Update no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:erp-updates] delete failed", e);
    return NextResponse.json({ error: "No se pudo eliminar la update" }, { status: 500 });
  }
}
