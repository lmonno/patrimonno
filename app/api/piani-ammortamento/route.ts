import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPianoSchema } from "@/lib/validations/piano-ammortamento";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const piani = await prisma.pianoAmmortamento.findMany({
      where: { userId: session.user.id },
      include: {
        conto: {
          select: {
            id: true,
            nome: true,
            rapporto: { select: { id: true, nome: true, istituto: true } },
          },
        },
        rate: {
          orderBy: { data: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(piani);
  } catch (error) {
    console.error("Errore GET piani ammortamento:", error);
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
    const parsed = createPianoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verifica che il conto appartenga all'utente
    const conto = await prisma.conto.findFirst({
      where: { id: parsed.data.contoId, rapporto: { userId: session.user.id } },
    });
    if (!conto) {
      return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
    }

    const piano = await prisma.pianoAmmortamento.create({
      data: {
        nome: parsed.data.nome,
        contoId: parsed.data.contoId,
        userId: session.user.id,
        rate: {
          create: parsed.data.rate.map((r) => ({
            data: new Date(r.data),
            quotaCapitale: parseFloat(r.quotaCapitale),
            quotaInteressi: parseFloat(r.quotaInteressi),
            rataTotale: parseFloat(r.rataTotale),
            debitoResiduo: parseFloat(r.debitoResiduo),
            contributo: r.contributo ? parseFloat(r.contributo) : 0,
          })),
        },
      },
      include: {
        conto: {
          select: {
            id: true,
            nome: true,
            rapporto: { select: { id: true, nome: true, istituto: true } },
          },
        },
        rate: { orderBy: { data: "asc" } },
      },
    });

    return NextResponse.json(piano, { status: 201 });
  } catch (error) {
    console.error("Errore POST piano ammortamento:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
