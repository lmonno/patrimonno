import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createFlussoSchema } from "@/lib/validations/flusso-straordinario";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const anno = searchParams.get("anno");
    const intestatarioId = searchParams.get("intestatarioId");

    const where: Record<string, unknown> = { userId: session.user.id };
    if (anno) {
      const y = parseInt(anno);
      where.data = {
        gte: new Date(`${y}-01-01`),
        lt: new Date(`${y + 1}-01-01`),
      };
    }
    if (intestatarioId) {
      if (intestatarioId === "comune") {
        where.intestatarioId = null;
      } else {
        where.intestatarioId = intestatarioId;
      }
    }

    const flussi = await prisma.flussoStraordinario.findMany({
      where,
      include: {
        categoria: { select: { id: true, nome: true } },
        intestatario: { select: { id: true, nome: true, cognome: true } },
      },
      orderBy: { data: "desc" },
    });

    return NextResponse.json(flussi);
  } catch (error) {
    console.error("Errore GET flussi-straordinari:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createFlussoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const ammortizzare = parsed.data.ammortizzare ?? false;
    const flusso = await prisma.flussoStraordinario.create({
      data: {
        data: new Date(parsed.data.data),
        importo: parseFloat(parsed.data.importo),
        descrizione: parsed.data.descrizione,
        categoriaId: parsed.data.categoriaId,
        intestatarioId: parsed.data.intestatarioId,
        ammortizzare,
        mesiAmmortamento: ammortizzare ? (parsed.data.mesiAmmortamento ?? 12) : null,
        userId: session.user.id,
      },
      include: {
        categoria: { select: { id: true, nome: true } },
        intestatario: { select: { id: true, nome: true, cognome: true } },
      },
    });

    return NextResponse.json(flusso, { status: 201 });
  } catch (error) {
    console.error("Errore POST flussi-straordinari:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
