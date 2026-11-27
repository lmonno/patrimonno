import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { spesaRicorrenteSchema } from "@/lib/validations/spesa-ricorrente";
import { parseItalianNumber } from "@/lib/formatNumbers";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const spese = await prisma.spesaRicorrente.findMany({
      where: { userId: session.user.id, deletedAt: null },
      include: {
        pagatori: {
          include: {
            intestatario: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(spese);
  } catch (error) {
    console.error("Errore GET spese-ricorrenti:", error);
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

    if (idsValidi.length === 0) {
      return NextResponse.json({ error: "Nessun pagatore valido" }, { status: 400 });
    }

    const spesa = await prisma.spesaRicorrente.create({
      data: {
        nome,
        importo: parseItalianNumber(importo),
        periodicita,
        meseScadenza,
        annoScadenza,
        note: note || null,
        userId: session.user.id,
        pagatori: {
          create: idsValidi.map((id) => ({ intestatarioId: id })),
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

    return NextResponse.json(spesa, { status: 201 });
  } catch (error) {
    console.error("Errore POST spese-ricorrenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
