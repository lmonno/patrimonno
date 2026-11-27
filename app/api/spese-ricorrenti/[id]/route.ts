import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spesaRicorrenteSchema } from "@/lib/validations/spesa-ricorrente";
import { parseItalianNumber } from "@/lib/formatNumbers";

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.spesaRicorrente.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = spesaRicorrenteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { nome, importo, periodicita, meseScadenza, annoScadenza, note, pagatoriIds } = parsed.data;

    const intestatariUtente = await prisma.intestatario.findMany({
      where: { id: { in: pagatoriIds }, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    const idsValidi = intestatariUtente.map((i) => i.id);

    const spesa = await prisma.$transaction(async (tx) => {
      await tx.spesaPagatore.deleteMany({ where: { spesaRicorrenteId: id } });

      return tx.spesaRicorrente.update({
        where: { id },
        data: {
          nome,
          importo: parseItalianNumber(importo),
          periodicita,
          meseScadenza,
          annoScadenza,
          note: note || null,
          pagatori: {
            create: idsValidi.map((intId) => ({ intestatarioId: intId })),
          },
        },
        include: {
          pagatori: {
            include: {
              intestatario: { select: { id: true, nome: true, cognome: true } },
            },
          },
        },
      });
    });

    return NextResponse.json(spesa);
  } catch (error) {
    console.error("Errore PUT spese-ricorrenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.spesaRicorrente.findFirst({
      where: { id, userId: session.user.id, deletedAt: null },
    });
    if (!existing) {
      return NextResponse.json({ error: "Spesa non trovata" }, { status: 404 });
    }

    await prisma.spesaRicorrente.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE spese-ricorrenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
