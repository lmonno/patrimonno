import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod/v4";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const categorie = await prisma.categoriaFlusso.findMany({
      where: { deletedAt: null },
      orderBy: { nome: "asc" },
    });

    return NextResponse.json(categorie);
  } catch (error) {
    console.error("Errore GET categorie-flusso:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = z.object({ nome: z.string().min(1, "Nome obbligatorio") }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dati non validi", details: parsed.error.flatten() }, { status: 400 });
    }

    // Upsert: se esiste (anche soft-deleted), riattiva
    const existing = await prisma.categoriaFlusso.findUnique({ where: { nome: parsed.data.nome } });
    if (existing) {
      if (existing.deletedAt) {
        const updated = await prisma.categoriaFlusso.update({
          where: { id: existing.id },
          data: { deletedAt: null },
        });
        return NextResponse.json(updated);
      }
      return NextResponse.json(existing);
    }

    const categoria = await prisma.categoriaFlusso.create({ data: { nome: parsed.data.nome } });
    return NextResponse.json(categoria, { status: 201 });
  } catch (error) {
    console.error("Errore POST categorie-flusso:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
