import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateUtenteSchema } from "@/lib/validations/utente";
import bcrypt from "bcryptjs";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.ruolo !== "ADMIN") return null;
  return session;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateUtenteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const utente = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!utente) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.ruolo) data.ruolo = parsed.data.ruolo;
    if (parsed.data.password) data.hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    const aggiornato = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, nome: true, email: true, ruolo: true, createdAt: true },
    });

    return NextResponse.json(aggiornato);
  } catch (error) {
    console.error("Errore PATCH utente:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const { id } = await params;

    if (session.user.id === id) {
      return NextResponse.json({ error: "Non puoi eliminare il tuo stesso account" }, { status: 400 });
    }

    const utente = await prisma.user.findUnique({ where: { id, deletedAt: null } });
    if (!utente) {
      return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
    }

    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE utente:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
