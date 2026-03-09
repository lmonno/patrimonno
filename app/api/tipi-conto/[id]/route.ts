import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tipoContoSchema } from "@/lib/validations/tipo-conto";

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
    const tipoConto = await prisma.tipoConto.findUnique({
      where: { id, deletedAt: null },
    });

    if (!tipoConto) {
      return NextResponse.json({ error: "Tipo conto non trovato" }, { status: 404 });
    }

    return NextResponse.json(tipoConto);
  } catch (error) {
    console.error("Errore GET tipo-conto:", error);
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
    const parsed = tipoContoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const tipoConto = await prisma.tipoConto.update({
      where: { id, deletedAt: null },
      data: parsed.data,
    });

    return NextResponse.json(tipoConto);
  } catch (error) {
    console.error("Errore PUT tipo-conto:", error);
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
    await prisma.tipoConto.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE tipo-conto:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
