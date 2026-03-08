import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tipoContoSchema } from "@/lib/validations/tipo-conto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const tipiConto = await prisma.tipoConto.findMany({
      where: { deletedAt: null },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(tipiConto);
  } catch (error) {
    console.error("Errore GET tipi-conto:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (session.user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = tipoContoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const tipoConto = await prisma.tipoConto.create({
      data: parsed.data,
    });

    return NextResponse.json(tipoConto, { status: 201 });
  } catch (error) {
    console.error("Errore POST tipi-conto:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
