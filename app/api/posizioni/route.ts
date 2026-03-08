import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPosizioneSchema } from "@/lib/validations/posizione";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const posizioni = await prisma.posizione.findMany({
      where: { deletedAt: null },
      include: {
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            user: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(posizioni);
  } catch (error) {
    console.error("Errore GET posizioni:", error);
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
    const parsed = createPosizioneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { intestatariIds, ...rest } = parsed.data;

    const posizione = await prisma.posizione.create({
      data: {
        ...rest,
        intestatari: {
          create: intestatariIds.map((userId) => ({ userId })),
        },
      },
      include: {
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            user: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
    });

    return NextResponse.json(posizione, { status: 201 });
  } catch (error) {
    console.error("Errore POST posizioni:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
