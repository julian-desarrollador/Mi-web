import { NextRequest, NextResponse } from "next/server";
import {
  insertCobro,
  insertCobrosBulk,
  listCobros,
  deleteCobrosByClient,
} from "@/app/lib/cobrosMongo";

export const runtime = "nodejs";

/** GET: listar cobros */
export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { error: "MongoDB no configurado" },
        { status: 503 }
      );
    }
    const cobros = await listCobros();
    return NextResponse.json({ cobros });
  } catch (e) {
    console.error("[admin:cobros] list failed", e);
    return NextResponse.json(
      { error: "No se pudieron cargar los cobros" },
      { status: 500 }
    );
  }
}

/** POST: crear cobro(s) - body puede ser uno o { cobros: [...] } para bulk */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { error: "MongoDB no configurado" },
        { status: 503 }
      );
    }
    const body = await req.json();

    // Bulk: { cobros: [{ clientName, amount, dueDate, servicio?, origen? }, ...] }
    if (Array.isArray(body.cobros) && body.cobros.length > 0) {
      const docs = body.cobros.map((c: Record<string, unknown>) => {
        const clientName = String(c.clientName || "").trim();
        const amount = Number(c.amount);
        const dueDate = String(c.dueDate || "").trim();
        if (!clientName || isNaN(amount) || amount <= 0 || !dueDate) {
          throw new Error("Cada cobro debe tener clientName, amount > 0 y dueDate (YYYY-MM-DD)");
        }
        const origenRaw = String(c.origen || "manual").trim();
        const origen: "manual" | "suscripcion_mp" =
          origenRaw === "suscripcion_mp" ? "suscripcion_mp" : "manual";
        return {
          clientName,
          amount,
          dueDate,
          paid: false,
          servicio: c.servicio ? String(c.servicio).trim() : undefined,
          notes: c.notes ? String(c.notes).trim() : undefined,
          origen,
          ...(c.chamba === true ? { chamba: true } : {}),
        };
      });
      const ids = await insertCobrosBulk(docs);
      return NextResponse.json({ ok: true, count: ids.length, ids });
    }

    // Single: { clientName, amount, dueDate, servicio?, paid?, paidAt?, origen? }
    const { clientName, amount, dueDate, servicio, paid, paidAt, origen, chamba } = body;
    const client = String(clientName || "").trim();
    if (!client) {
      return NextResponse.json(
        { error: "El nombre del cliente es requerido" },
        { status: 400 }
      );
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json(
        { error: "El monto debe ser un número positivo" },
        { status: 400 }
      );
    }
    const dateStr = String(dueDate || "").trim();
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json(
        { error: "La fecha de cobro es requerida (formato YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const origenRaw = String(origen || "manual").trim();
    const cobroOrigen: "manual" | "suscripcion_mp" =
      origenRaw === "suscripcion_mp" ? "suscripcion_mp" : "manual";

    const doc = {
      clientName: client,
      amount: numAmount,
      dueDate: dateStr,
      paid: Boolean(paid),
      paidAt: paidAt && /^\d{4}-\d{2}-\d{2}$/.test(String(paidAt)) ? String(paidAt) : undefined,
      servicio: servicio ? String(servicio).trim() : undefined,
      notes: undefined,
      origen: cobroOrigen,
      ...(chamba === true ? { chamba: true } : {}),
    };

    const id = await insertCobro(doc);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[admin:cobros] insert failed", e);
    const msg = e instanceof Error ? e.message : "No se pudo guardar";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** DELETE: eliminar todos los cobros de un cliente (?client=Nombre) */
export async function DELETE(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { error: "MongoDB no configurado" },
        { status: 503 }
      );
    }
    const { searchParams } = new URL(req.url);
    const client = searchParams.get("client")?.trim();
    if (!client) {
      return NextResponse.json(
        { error: "Se requiere el parámetro client" },
        { status: 400 }
      );
    }
    const count = await deleteCobrosByClient(client);
    return NextResponse.json({ ok: true, count });
  } catch (e) {
    console.error("[admin:cobros] deleteByClient failed", e);
    return NextResponse.json(
      { error: "No se pudieron eliminar los cobros" },
      { status: 500 }
    );
  }
}
