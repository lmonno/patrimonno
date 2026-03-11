import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createContoSchema } from "@/lib/validations/conto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id: rapportoId } = await params;

    // Verifica che il rapporto esista
    const rapporto = await prisma.rapporto.findUnique({
      where: { id: rapportoId, deletedAt: null },
    });
    if (!rapporto) {
      return NextResponse.json({ error: "Rapporto non trovato" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = createContoSchema.safeParse({ ...body, rapportoId });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { intestatariIds, ...rest } = parsed.data;

    const conto = await prisma.conto.create({
      data: {
        ...rest,
        intestatari: {
          create: intestatariIds.map((intestatarioId) => ({ intestatarioId })),
        },
      },
      include: {
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            intestatario: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    return NextResponse.json(conto, { status: 201 });
  } catch (error) {
    console.error("Errore POST conti rapporto:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
