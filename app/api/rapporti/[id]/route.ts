import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateRapportoSchema } from "@/lib/validations/rapporto";

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
    const rapporto = await prisma.rapporto.findUnique({
      where: { id, deletedAt: null },
      include: {
        conti: {
          where: { deletedAt: null },
          include: {
            tipoConto: { select: { id: true, nome: true } },
            intestatari: {
              include: {
                intestatario: { select: { id: true, nome: true, cognome: true } },
              },
            },
          },
          orderBy: { nome: "asc" },
        },
      },
    });

    if (!rapporto) {
      return NextResponse.json({ error: "Rapporto non trovato" }, { status: 404 });
    }

    return NextResponse.json(rapporto);
  } catch (error) {
    console.error("Errore GET rapporto:", error);
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
    const parsed = updateRapportoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rapporto = await prisma.rapporto.update({
      where: { id, deletedAt: null },
      data: parsed.data,
      include: {
        conti: {
          where: { deletedAt: null },
          include: {
            tipoConto: { select: { id: true, nome: true } },
            intestatari: {
              include: {
                intestatario: { select: { id: true, nome: true, cognome: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(rapporto);
  } catch (error) {
    console.error("Errore PUT rapporto:", error);
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
    const now = new Date();

    // Soft delete del rapporto e di tutti i suoi conti
    await prisma.$transaction([
      prisma.conto.updateMany({
        where: { rapportoId: id, deletedAt: null },
        data: { deletedAt: now },
      }),
      prisma.rapporto.update({
        where: { id },
        data: { deletedAt: now },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE rapporto:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
