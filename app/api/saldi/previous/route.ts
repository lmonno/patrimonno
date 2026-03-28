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
    const annoParam = searchParams.get("anno");
    const meseParam = searchParams.get("mese");

    if (!annoParam || !meseParam) {
      return NextResponse.json(
        { error: "Parametri anno e mese obbligatori" },
        { status: 400 }
      );
    }

    const anno = parseInt(annoParam);
    const mese = parseInt(meseParam);

    // Calcola mese precedente
    const prevMese = mese === 1 ? 12 : mese - 1;
    const prevAnno = mese === 1 ? anno - 1 : anno;

    const saldi = await prisma.saldo.findMany({
      where: {
        anno: prevAnno,
        mese: prevMese,
        conto: { rapporto: { userId: session.user.id } },
      },
      select: {
        contoId: true,
        valore: true,
      },
    });

    // Ritorna un oggetto { contoId: valore } per lookup rapido
    const result: Record<string, string> = {};
    for (const s of saldi) {
      result[s.contoId] = s.valore.toString();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Errore GET saldi/previous:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
