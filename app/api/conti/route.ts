import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const conti = await prisma.conto.findMany({
      where: { deletedAt: null },
      include: {
        rapporto: { select: { id: true, nome: true, istituto: true } },
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
