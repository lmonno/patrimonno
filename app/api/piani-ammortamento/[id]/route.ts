import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePianoSchema } from "@/lib/validations/piano-ammortamento";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    const piano = await prisma.pianoAmmortamento.findFirst({
      where: { id, userId: session.user.id },
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

    if (!piano) {
      return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
    }

    return NextResponse.json(piano);
  } catch (error) {
    console.error("Errore GET piano ammortamento:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.pianoAmmortamento.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = updatePianoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    if (parsed.data.contoId) {
      const conto = await prisma.conto.findFirst({
        where: { id: parsed.data.contoId, rapporto: { userId: session.user.id } },
      });
      if (!conto) {
        return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
      }
    }

    const piano = await prisma.$transaction(async (tx) => {
      if (parsed.data.rate) {
        await tx.rataAmmortamento.deleteMany({ where: { pianoAmmortamentoId: id } });
      }

      return tx.pianoAmmortamento.update({
        where: { id },
        data: {
          ...(parsed.data.nome && { nome: parsed.data.nome }),
          ...(parsed.data.contoId && { contoId: parsed.data.contoId }),
          ...(parsed.data.rate && {
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
          }),
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
    });

    return NextResponse.json(piano);
  } catch (error) {
    console.error("Errore PUT piano ammortamento:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.pianoAmmortamento.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Piano non trovato" }, { status: 404 });
    }

    await prisma.pianoAmmortamento.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE piano ammortamento:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
