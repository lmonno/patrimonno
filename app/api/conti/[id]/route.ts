import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateContoSchema } from "@/lib/validations/conto";

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
    const conto = await prisma.conto.findUnique({
      where: { id, deletedAt: null },
      include: {
        rapporto: { select: { id: true, nome: true, istituto: true, iban: true } },
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            intestatario: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    if (!conto) {
      return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
    }

    return NextResponse.json(conto);
  } catch (error) {
    console.error("Errore GET conto:", error);
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
    const body = await request.json();
    const parsed = updateContoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { intestatariIds, ...rest } = parsed.data;

    if (intestatariIds) {
      await prisma.$transaction([
        prisma.contoIntestatario.deleteMany({
          where: { contoId: id },
        }),
        prisma.conto.update({
          where: { id, deletedAt: null },
          data: {
            ...rest,
            intestatari: {
              create: intestatariIds.map((intestatarioId) => ({ intestatarioId })),
            },
          },
        }),
      ]);
    } else {
      await prisma.conto.update({
        where: { id, deletedAt: null },
        data: rest,
      });
    }

    const conto = await prisma.conto.findUnique({
      where: { id },
      include: {
        rapporto: { select: { id: true, nome: true, istituto: true, iban: true } },
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            intestatario: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    return NextResponse.json(conto);
  } catch (error) {
    console.error("Errore PUT conto:", error);
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
    await prisma.conto.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE conto:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
