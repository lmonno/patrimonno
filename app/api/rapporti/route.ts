import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createRapportoSchema } from "@/lib/validations/rapporto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const rapporti = await prisma.rapporto.findMany({
      where: { deletedAt: null, userId: session.user.id },
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
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(rapporti);
  } catch (error) {
    console.error("Errore GET rapporti:", error);
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
    const parsed = createRapportoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const rapporto = await prisma.rapporto.create({
      data: { ...parsed.data, userId: session.user.id },
      include: {
        conti: true,
      },
    });

    return NextResponse.json(rapporto, { status: 201 });
  } catch (error) {
    console.error("Errore POST rapporti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
