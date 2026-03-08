import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createIntestatarioSchema } from "@/lib/validations/intestatario";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const intestatari = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
        createdAt: true,
      },
      orderBy: { cognome: "asc" },
    });

    return NextResponse.json(intestatari);
  } catch (error) {
    console.error("Errore GET intestatari:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }
    if (session.user.ruolo !== "ADMIN") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = createIntestatarioSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { password, ...rest } = parsed.data;
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        ...rest,
        hashedPassword,
      },
      select: {
        id: true,
        nome: true,
        cognome: true,
        email: true,
        ruolo: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error("Errore POST intestatari:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
