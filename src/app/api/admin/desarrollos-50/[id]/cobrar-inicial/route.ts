import { NextRequest, NextResponse } from "next/server";
import { insertAccountingRecord } from "@/app/lib/accountingMongo";
import { getDesarrollo50ById, updateDesarrollo50 } from "@/app/lib/desarrollos50Mongo";
import { ingresoDescripcionDesarrollo50 } from "@/app/admin92/contabilidad/lib/desarrollos50Labels";

export const runtime = "nodejs";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** POST: registrar el 1.er 50% de un lead que se cargó sin pago (p. ej. venía de prueba gratis) */
export async function POST(
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

    const existing = await getDesarrollo50ById(id);
    if (!existing) {
      return NextResponse.json({ error: "Lead no encontrado" }, { status: 404 });
    }
    if (existing.activo === false) {
      return NextResponse.json({ error: "Este desarrollo ya está cerrado" }, { status: 400 });
    }
    if (existing.accountingRecordId) {
      return NextResponse.json({ error: "El 1.er 50% ya está registrado" }, { status: 400 });
    }

    const body = await req.json();
    const fechaCobro50 =
      typeof body.fechaCobro50 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fechaCobro50)
        ? body.fechaCobro50
        : todayYmd();
    const monto = Number(body.montoCobrado50);
    if (Number.isNaN(monto) || monto <= 0) {
      return NextResponse.json({ error: "El monto del 50% inicial es requerido" }, { status: 400 });
    }

    const accountingId = await insertAccountingRecord({
      type: "ingreso",
      amount: monto,
      description: ingresoDescripcionDesarrollo50(existing.clientName, existing.name, "inicio"),
      category: existing.servicio || "Desarrollo",
      date: new Date(`${fechaCobro50}T12:00:00.000Z`),
    });

    const ok = await updateDesarrollo50(id, {
      fechaCobro50,
      montoCobrado50: monto,
      accountingRecordId: accountingId.toString(),
    });
    if (!ok) {
      return NextResponse.json({ error: "No se pudo registrar el 1.er 50%" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, accountingRecordId: accountingId.toString() });
  } catch (e) {
    console.error("[admin:desarrollos-50] cobrar-inicial failed", e);
    return NextResponse.json({ error: "No se pudo registrar el 1.er 50%" }, { status: 500 });
  }
}
