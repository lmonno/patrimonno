import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateIntestatarioSchema } from "@/lib/validations/intestatario";

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
    const user = await prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "Intestatario non trovato" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Errore GET intestatario:", error);
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
    const parsed = updateIntestatarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { password, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };

    if (password) {
      updateData.hashedPassword = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id, deletedAt: null },
      data: updateData,
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("Errore PUT intestatario:", error);
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

    if (id === session.user.id) {
      return NextResponse.json(
        { error: "Non puoi eliminare il tuo stesso account" },
        { status: 400 }
      );
    }

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE intestatario:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
