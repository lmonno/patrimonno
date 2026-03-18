import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateOrdineSchema } from "@/lib/validations/conto";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = updateOrdineSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      parsed.data.ordine.map((item) =>
        prisma.conto.update({
          where: { id: item.id },
          data: { ordine: item.ordine },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore PATCH ordine conti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
