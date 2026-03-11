import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUtenteSchema } from "@/lib/validations/utente";
import bcrypt from "bcryptjs";

async function checkAdmin() {
  const session = await auth();
  if (!session?.user) return null;
  if (session.user.ruolo !== "ADMIN") return null;
  return session;
}

export async function GET() {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const utenti = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nome: true,
        email: true,
        ruolo: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(utenti);
  } catch (error) {
    console.error("Errore GET utenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await checkAdmin();
    if (!session) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createUtenteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const esistente = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (esistente) {
      return NextResponse.json({ error: "Email già in uso" }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);

    const utente = await prisma.user.create({
      data: {
        nome: parsed.data.nome,
        email: parsed.data.email,
        hashedPassword,
        ruolo: parsed.data.ruolo,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        ruolo: true,
        createdAt: true,
      },
    });

    return NextResponse.json(utente, { status: 201 });
  } catch (error) {
    console.error("Errore POST utenti:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
