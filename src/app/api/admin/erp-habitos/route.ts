import { NextRequest, NextResponse } from "next/server";
import { insertErpHabito, listErpHabitos } from "@/app/lib/erpHabitosMongo";
import { parseHabitoText } from "@/app/admin92/erp/lib/erpHabitos";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const habitos = await listErpHabitos();
    return NextResponse.json({ habitos });
  } catch (error) {
    console.error("[admin:erp-habitos] list failed", error);
    return NextResponse.json({ error: "No se pudieron cargar los hábitos" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MongoDB no configurado" }, { status: 503 });
    }
    const body: unknown = await req.json();
    const text = body && typeof body === "object" ? (body as { text?: unknown }).text : "";
    const parsed = parseHabitoText(text);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const habito = await insertErpHabito(parsed.text);
    return NextResponse.json({ ok: true, habito });
  } catch (error) {
    console.error("[admin:erp-habitos] create failed", error);
    return NextResponse.json({ error: "No se pudo crear el hábito" }, { status: 500 });
  }
}
