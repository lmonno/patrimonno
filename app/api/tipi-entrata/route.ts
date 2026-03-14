import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const tipi = await prisma.tipoEntrata.findMany({
      where: { deletedAt: null },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(tipi);
  } catch (error) {
    console.error("Errore GET tipi entrata:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
