import { NextRequest, NextResponse } from "next/server";
import { insertAccountingRecord } from "@/app/lib/accountingMongo";
import { insertDesarrollo50, listDesarrollos50Activos } from "@/app/lib/desarrollos50Mongo";
import { ingresoDescripcionDesarrollo50 } from "@/app/admin92/contabilidad/lib/desarrollos50Labels";
import { parseLeadFields } from "@/app/admin92/contabilidad/lib/leads";

export const runtime = "nodejs";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** GET: listar desarrollos 50% activos */
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const desarrollos = await listDesarrollos50Activos();
    return NextResponse.json({ desarrollos });
  } catch (e) {
    console.error("[admin:desarrollos-50] list failed", e);
    return NextResponse.json({ error: "No se pudieron cargar los desarrollos" }, { status: 500 });
  }
}

/** POST: nuevo lead / desarrollo 50% (+ ingreso del 1.er cobro si se informa monto) */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body = await req.json();
    const name = String(body.name || "").trim();
    const clientName = String(body.clientName || "").trim();
    if (!name) {
      return NextResponse.json({ error: "El proyecto / negocio es requerido" }, { status: 400 });
    }
    if (!clientName) {
      return NextResponse.json({ error: "El cliente es requerido" }, { status: 400 });
    }

    const { fields: leadFields, error: leadError } = parseLeadFields(body);
    if (leadError) {
      return NextResponse.json({ error: leadError }, { status: 400 });
    }
    if (leadFields.prueba && !leadFields.pruebaInicio) {
      leadFields.pruebaInicio = todayYmd();
    }

    // El 1.er 50% es opcional: un lead puede venir del SaaS con prueba gratis, sin pago todavía
    const montoInput = body.montoCobrado50;
    const hasMonto = montoInput !== undefined && montoInput !== null && String(montoInput).trim() !== "";
    const monto = hasMonto ? Number(montoInput) : undefined;
    if (hasMonto && (monto === undefined || Number.isNaN(monto) || monto <= 0)) {
      return NextResponse.json({ error: "El monto del 50% inicial debe ser un número positivo" }, { status: 400 });
    }

    const servicio = body.servicio ? String(body.servicio).trim() : undefined;
    let fechaCobro50: string | undefined;
    let accountingRecordId: string | undefined;
    if (monto !== undefined) {
      fechaCobro50 =
        typeof body.fechaCobro50 === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fechaCobro50)
          ? body.fechaCobro50
          : todayYmd();
      const accountingId = await insertAccountingRecord({
        type: "ingreso",
        amount: monto,
        description: ingresoDescripcionDesarrollo50(clientName, name, "inicio"),
        category: servicio || "Desarrollo",
        date: new Date(`${fechaCobro50}T12:00:00.000Z`),
      });
      accountingRecordId = accountingId.toString();
    }

    const id = await insertDesarrollo50({
      clientName,
      name,
      servicio,
      ...(fechaCobro50 ? { fechaCobro50 } : {}),
      ...(monto !== undefined ? { montoCobrado50: monto } : {}),
      ...(accountingRecordId ? { accountingRecordId } : {}),
      ...leadFields,
      activo: true,
    });
    return NextResponse.json({ ok: true, id, accountingRecordId: accountingRecordId ?? null });
  } catch (e) {
    console.error("[admin:desarrollos-50] insert failed", e);
    return NextResponse.json({ error: "No se pudo guardar el desarrollo" }, { status: 500 });
  }
}
