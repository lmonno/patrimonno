import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updatePosizioneSchema } from "@/lib/validations/posizione";

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
    const posizione = await prisma.posizione.findUnique({
      where: { id, deletedAt: null },
      include: {
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            user: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    if (!posizione) {
      return NextResponse.json({ error: "Posizione non trovata" }, { status: 404 });
    }

    return NextResponse.json(posizione);
  } catch (error) {
    console.error("Errore GET posizione:", error);
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
    if (session.user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updatePosizioneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { intestatariIds, ...rest } = parsed.data;

    if (intestatariIds) {
      await prisma.$transaction([
        prisma.posizioneIntestatario.deleteMany({
          where: { posizioneId: id },
        }),
        prisma.posizione.update({
          where: { id, deletedAt: null },
          data: {
            ...rest,
            intestatari: {
              create: intestatariIds.map((userId) => ({ userId })),
            },
          },
        }),
      ]);
    } else {
      await prisma.posizione.update({
        where: { id, deletedAt: null },
        data: rest,
      });
    }

    const posizione = await prisma.posizione.findUnique({
      where: { id },
      include: {
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            user: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    return NextResponse.json(posizione);
  } catch (error) {
    console.error("Errore PUT posizione:", error);
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
    if (session.user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { id } = await params;
    await prisma.posizione.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE posizione:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
