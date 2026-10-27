import { NextRequest, NextResponse } from "next/server";
import { parseMoodPause, parseMoodStart } from "@/app/admin92/erp/lib/erpHabitos";
import {
  deleteErpMood,
  findOpenErpMood,
  insertErpMood,
  listErpMoods,
  pauseErpMood,
} from "@/app/lib/erpHabitosMongo";

export const runtime = "nodejs";

function mongoGuard() {
  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
  }
  return null;
}

export async function GET() {
  try {
    const unavailable = mongoGuard();
    if (unavailable) return unavailable;
    const moods = await listErpMoods();
    return NextResponse.json({ moods });
  } catch (error) {
    console.error("[admin:erp-moods] list failed", error);
    return NextResponse.json({ error: "No se pudieron cargar los moods" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const unavailable = mongoGuard();
    if (unavailable) return unavailable;
    const parsed = parseMoodStart(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const open = await findOpenErpMood(parsed.value.date);
    if (open) {
      return NextResponse.json({ error: "Hay un mood abierto. Primero hacé pausa." }, { status: 409 });
    }
    const mood = await insertErpMood(parsed.value);
    return NextResponse.json({ ok: true, mood });
  } catch (error) {
    console.error("[admin:erp-moods] start failed", error);
    return NextResponse.json({ error: "No se pudo arrancar el mood" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const unavailable = mongoGuard();
    if (unavailable) return unavailable;
    const parsed = parseMoodPause(await req.json());
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const mood = await pauseErpMood(parsed.value.id, parsed.value.endedAt);
    if (!mood) {
      return NextResponse.json({ error: "No hay un mood abierto para pausar" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, mood });
  } catch (error) {
    console.error("[admin:erp-moods] pause failed", error);
    return NextResponse.json({ error: "No se pudo pausar el mood" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const unavailable = mongoGuard();
    if (unavailable) return unavailable;
    const id = req.nextUrl.searchParams.get("id") || "";
    if (!id) {
      return NextResponse.json({ error: "Falta el mood" }, { status: 400 });
    }
    const removed = await deleteErpMood(id);
    if (!removed) {
      return NextResponse.json({ error: "No se encontró el mood" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[admin:erp-moods] delete failed", error);
    return NextResponse.json({ error: "No se pudo quitar el mood" }, { status: 500 });
  }
}
