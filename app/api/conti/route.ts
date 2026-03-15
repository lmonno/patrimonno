import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const archiviatoParam = searchParams.get("archiviato");

    const where: Record<string, unknown> = { deletedAt: null };
    if (archiviatoParam === "false") {
      where.archiviato = false;
      where.rapporto = { archiviato: false };
    }

    const conti = await prisma.conto.findMany({
      where,
      include: {
        rapporto: { select: { id: true, nome: true, istituto: true, iban: true } },
        tipoConto: { select: { id: true, nome: true } },
        intestatari: {
          include: {
            intestatario: { select: { id: true, nome: true, cognome: true } },
          },
        },
      },
      orderBy: [{ rapporto: { nome: "asc" } }, { nome: "asc" }],
    });

    return NextResponse.json(conti);
  } catch (error) {
    console.error("Errore GET conti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
