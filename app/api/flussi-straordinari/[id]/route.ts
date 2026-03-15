import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateFlussoSchema } from "@/lib/validations/flusso-straordinario";

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
    const parsed = updateFlussoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.data !== undefined) data.data = new Date(parsed.data.data);
    if (parsed.data.importo !== undefined) data.importo = parseFloat(parsed.data.importo);
    if (parsed.data.descrizione !== undefined) data.descrizione = parsed.data.descrizione;
    if (parsed.data.categoriaId !== undefined) data.categoriaId = parsed.data.categoriaId;
    if (parsed.data.intestatarioId !== undefined) data.intestatarioId = parsed.data.intestatarioId;

    const flusso = await prisma.flussoStraordinario.update({
      where: { id },
      data,
      include: {
        categoria: { select: { id: true, nome: true } },
        intestatario: { select: { id: true, nome: true, cognome: true } },
      },
    });

    return NextResponse.json(flusso);
  } catch (error) {
    console.error("Errore PUT flussi-straordinari:", error);
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
    await prisma.flussoStraordinario.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE flussi-straordinari:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
