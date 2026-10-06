import { NextRequest, NextResponse } from "next/server";
import {
  updateAccountingRecord,
  deleteAccountingRecord,
  type AccountingType,
} from "@/app/lib/accountingMongo";
import { setCobrosChambaByAccountingRecordId } from "@/app/lib/cobrosMongo";

export const runtime = "nodejs";

/** PATCH: actualizar registro */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { error: "MongoDB no configurado" },
        { status: 503 }
      );
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const body = await req.json();
    const { type, amount, description, category, date, chamba } = body;

    const updates: Record<string, unknown> = {};

    if (type !== undefined) {
      if (!["ingreso", "gasto", "inversion"].includes(type as AccountingType)) {
        return NextResponse.json(
          { error: "Tipo inválido (ingreso, gasto, inversion)" },
          { status: 400 }
        );
      }
      updates.type = type;
    }
    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: "Monto debe ser un número positivo" },
          { status: 400 }
        );
      }
      updates.amount = numAmount;
    }
    if (description !== undefined) {
      const desc = String(description).trim();
      if (!desc) {
        return NextResponse.json(
          { error: "La descripción no puede estar vacía" },
          { status: 400 }
        );
      }
      updates.description = desc;
    }
    if (category !== undefined) {
      updates.category = category ? String(category).trim() : undefined;
    }
    if (date !== undefined) {
      const recordDate = date
        ? new Date(date.includes("T") ? date : `${date}T12:00:00.000Z`)
        : new Date();
      updates.date = recordDate;
    }
    if (chamba !== undefined) {
      updates.chamba = chamba === true;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
    }

    const ok = await updateAccountingRecord(id, updates as Parameters<typeof updateAccountingRecord>[1]);
    if (chamba !== undefined) {
      await setCobrosChambaByAccountingRecordId(id, chamba === true);
    }
    return NextResponse.json({ ok });
  } catch (e) {
    console.error("[admin:accounting] update failed", e);
    return NextResponse.json(
      { error: "No se pudo actualizar el registro" },
      { status: 500 }
    );
  }
}

/** DELETE: eliminar registro */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        { error: "MongoDB no configurado" },
        { status: 503 }
      );
    }
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const ok = await deleteAccountingRecord(id);
    if (!ok) {
      return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:accounting] delete failed", e);
    return NextResponse.json(
      { error: "No se pudo eliminar el registro" },
      { status: 500 }
    );
  }
}
