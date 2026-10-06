import { NextRequest, NextResponse } from "next/server";
import {
  getCobroById,
  updateCobro,
  updateCobrosByClient,
  deleteCobro,
} from "@/app/lib/cobrosMongo";
import { insertAccountingRecord, updateAccountingRecord } from "@/app/lib/accountingMongo";

export const runtime = "nodejs";

function todayYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultCuotaDescripcion(cobro: {
  clientName: string;
  servicio?: string;
}): string {
  const servicioLabel = cobro.servicio;
  return servicioLabel
    ? `${cobro.clientName} (${servicioLabel}) - Cuota`
    : `${cobro.clientName} - Cuota`;
}

function resolveCuotaDescripcion(cobro: {
  clientName: string;
  servicio?: string;
  descripcionCuota?: string;
}): string {
  const custom = cobro.descripcionCuota?.trim();
  if (custom) return custom;
  return defaultCuotaDescripcion(cobro);
}

/** PATCH: actualizar cobro (amount, servicio, paid, paidAt) o actualizar cuotas futuras */
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

    const existing = await getCobroById(id);
    if (!existing) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
    }

    const body = await req.json();
    const {
      amount,
      servicio,
      paid,
      paidAt,
      dueDate,
      dueDateFrom,
      fechaIngreso,
      estadisticasEnviadas,
      fechaEnvioEstadisticas,
      recordatorioEnviado,
      updateFuture,
      origen,
      notes,
      prioridad,
      cambioPendiente,
      solicitudTasks,
      descripcionCuota,
      requiereEstadisticas,
      chamba,
    } = body;

    const updates: Record<string, unknown> = {};
    let unsetFields: string[] = [];

    if (amount !== undefined) {
      const numAmount = Number(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        return NextResponse.json(
          { error: "El monto debe ser un número positivo" },
          { status: 400 }
        );
      }
      updates.amount = numAmount;
    }
    if (servicio !== undefined) {
      updates.servicio = servicio ? String(servicio).trim() : undefined;
    }
    if (paid !== undefined) {
      updates.paid = Boolean(paid);
      if (!paid) {
        unsetFields.push("paidAt", "accountingRecordId", "fechaCobro");
      }
    }
    if (paidAt !== undefined && paidAt !== null) {
      updates.paidAt = /^\d{4}-\d{2}-\d{2}$/.test(String(paidAt)) ? String(paidAt) : undefined;
    }
    if (dueDate !== undefined && dueDate !== null) {
      const dueDateStr = String(dueDate).trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDateStr)) {
        return NextResponse.json(
          { error: "La fecha de cobro debe tener formato YYYY-MM-DD" },
          { status: 400 }
        );
      }
      updates.dueDate = dueDateStr;
    }
    if (estadisticasEnviadas !== undefined) {
      updates.estadisticasEnviadas = Boolean(estadisticasEnviadas);
      if (estadisticasEnviadas) {
        const fechaStr =
          fechaEnvioEstadisticas &&
          /^\d{4}-\d{2}-\d{2}$/.test(String(fechaEnvioEstadisticas))
            ? String(fechaEnvioEstadisticas)
            : todayYmd();
        updates.fechaEnvioEstadisticas = fechaStr;
      } else {
        unsetFields.push("fechaEnvioEstadisticas");
      }
    } else if (
      fechaEnvioEstadisticas !== undefined &&
      fechaEnvioEstadisticas !== null &&
      /^\d{4}-\d{2}-\d{2}$/.test(String(fechaEnvioEstadisticas)) &&
      existing.estadisticasEnviadas
    ) {
      updates.fechaEnvioEstadisticas = String(fechaEnvioEstadisticas);
    }
    if (recordatorioEnviado !== undefined) {
      updates.recordatorioEnviado = Boolean(recordatorioEnviado);
    }
    if (origen !== undefined) {
      updates.origen = String(origen) === "suscripcion_mp" ? "suscripcion_mp" : "manual";
    }
    if (notes !== undefined) {
      const notesStr = String(notes).trim();
      if (notesStr) {
        updates.notes = notesStr;
      } else {
        unsetFields.push("notes");
      }
    }
    if (prioridad !== undefined) {
      if (prioridad === null || prioridad === "") {
        unsetFields.push("prioridad");
      } else {
        const prioridadVal = Number(prioridad);
        if (!Number.isFinite(prioridadVal) || !Number.isInteger(prioridadVal) || prioridadVal < 0) {
          return NextResponse.json(
            { error: "La prioridad debe ser un entero >= 0" },
            { status: 400 }
          );
        }
        updates.prioridad = prioridadVal;
      }
    }
    if (cambioPendiente !== undefined) {
      updates.cambioPendiente = Boolean(cambioPendiente);
    }
    if (requiereEstadisticas !== undefined) {
      updates.requiereEstadisticas = Boolean(requiereEstadisticas);
    }
    if (chamba !== undefined) {
      const nextChamba = chamba === true;
      updates.chamba = nextChamba;
      if (existing.accountingRecordId) {
        await updateAccountingRecord(existing.accountingRecordId, { chamba: nextChamba });
      }
    }
    if (solicitudTasks !== undefined) {
      if (!Array.isArray(solicitudTasks)) {
        return NextResponse.json(
          { error: "solicitudTasks debe ser un array" },
          { status: 400 }
        );
      }
      const tasks = solicitudTasks
        .map(
          (t: {
            id?: string;
            text?: string;
            done?: boolean;
            createdAt?: string;
            fueraColaActiva?: boolean;
            fechaRealizada?: string;
          }) => {
          const created =
            t.createdAt && /^\d{4}-\d{2}-\d{2}$/.test(String(t.createdAt))
              ? String(t.createdAt)
              : undefined;
          const realizada =
            t.fechaRealizada && /^\d{4}-\d{2}-\d{2}$/.test(String(t.fechaRealizada))
              ? String(t.fechaRealizada)
              : undefined;
          const done = Boolean(t.done);
          return {
            id: String(t.id || "").trim() || `t_${Date.now()}`,
            text: String(t.text || "").trim(),
            done,
            ...(created ? { createdAt: created } : {}),
            ...(t.fueraColaActiva ? { fueraColaActiva: true } : {}),
            ...(done && realizada ? { fechaRealizada: realizada } : {}),
          };
        },
        )
        .filter((t: { text: string }) => t.text.length > 0);
      updates.solicitudTasks = tasks;
    }
    if (descripcionCuota !== undefined) {
      const trimmed = String(descripcionCuota || "").trim();
      if (trimmed) {
        updates.descripcionCuota = trimmed;
      } else {
        unsetFields.push("descripcionCuota");
      }
    }

    if (updateFuture && amount !== undefined && body.clientName) {
      const numAmount = Number(amount);
      if (!isNaN(numAmount) && numAmount > 0) {
        await updateCobrosByClient(
          String(body.clientName).trim(),
          String(dueDateFrom || dueDate || existing.dueDate || ""),
          { amount: numAmount }
        );
      }
    }

  // Sync cuota pagada → ingreso contable
    if (paid === true && !existing.accountingRecordId) {
      const fechaStr =
        fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(String(fechaIngreso))
          ? String(fechaIngreso)
          : todayYmd();
      updates.fechaCobro = fechaStr;
      updates.paidAt = fechaStr;
      const monto = (updates.amount as number | undefined) ?? existing.amount;
      const description = resolveCuotaDescripcion({
        clientName: existing.clientName,
        servicio: existing.servicio || (updates.servicio as string | undefined),
        descripcionCuota: existing.descripcionCuota,
      });
      const servicioLabel = existing.servicio || (updates.servicio as string | undefined);

      const esChamba = (updates.chamba as boolean | undefined) ?? existing.chamba === true;
      const insertedId = await insertAccountingRecord({
        type: "ingreso",
        amount: monto,
        description,
        category: servicioLabel || "Cuota cliente",
        date: new Date(`${fechaStr}T12:00:00.000Z`),
        ...(esChamba ? { chamba: true } : {}),
      });
      updates.accountingRecordId = insertedId.toString();
    }

    // Corregir fecha de cobro en cuota ya pagada
    if (
      fechaIngreso !== undefined &&
      fechaIngreso !== null &&
      paid === undefined &&
      existing.paid
    ) {
      const fechaStr = /^\d{4}-\d{2}-\d{2}$/.test(String(fechaIngreso))
        ? String(fechaIngreso)
        : null;
      if (!fechaStr) {
        return NextResponse.json(
          { error: "La fecha de cobro debe tener formato YYYY-MM-DD" },
          { status: 400 },
        );
      }
      updates.fechaCobro = fechaStr;
      updates.paidAt = fechaStr;
      if (existing.accountingRecordId) {
        await updateAccountingRecord(existing.accountingRecordId, {
          date: new Date(`${fechaStr}T12:00:00.000Z`),
        });
      }
    }

    if (paid === true && existing.accountingRecordId) {
      const fechaStr =
        fechaIngreso && /^\d{4}-\d{2}-\d{2}$/.test(String(fechaIngreso))
          ? String(fechaIngreso)
          : todayYmd();
      updates.fechaCobro = fechaStr;
      updates.paidAt = fechaStr;
    }

    if (descripcionCuota !== undefined && existing.accountingRecordId) {
      const servicioLabel =
        (updates.servicio as string | undefined) ?? existing.servicio;
      const description = resolveCuotaDescripcion({
        clientName: existing.clientName,
        servicio: servicioLabel,
        descripcionCuota:
          String(descripcionCuota || "").trim() || undefined,
      });
      await updateAccountingRecord(existing.accountingRecordId, { description });
    }

    if (Object.keys(updates).length > 0 || unsetFields.length > 0) {
      const ok = await updateCobro(id, updates, unsetFields.length > 0 ? unsetFields : undefined);
      return NextResponse.json({ ok, accountingRecordId: updates.accountingRecordId ?? existing.accountingRecordId });
    }

    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  } catch (e) {
    console.error("[admin:cobros] update failed", e);
    return NextResponse.json(
      { error: "No se pudo actualizar el cobro" },
      { status: 500 }
    );
  }
}

/** DELETE: eliminar cobro */
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

    const ok = await deleteCobro(id);
    if (!ok) {
      return NextResponse.json({ error: "Cobro no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin:cobros] delete failed", e);
    return NextResponse.json(
      { error: "No se pudo eliminar el cobro" },
      { status: 500 }
    );
  }
}
