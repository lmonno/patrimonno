import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bulkUpsertEntrataSchema } from "@/lib/validations/entrata";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const anno = searchParams.get("anno");
    const mese = searchParams.get("mese");
    const intestatarioId = searchParams.get("intestatarioId");

    const where: Record<string, unknown> = { intestatario: { userId: session.user.id } };
    if (anno) where.anno = parseInt(anno);
    if (mese) where.mese = parseInt(mese);
    if (intestatarioId) where.intestatarioId = intestatarioId;

    const entrate = await prisma.entrata.findMany({
      where,
      include: {
        intestatario: { select: { id: true, nome: true, cognome: true } },
        tipoEntrata: { select: { id: true, nome: true } },
      },
      orderBy: [
        { mese: "asc" },
        { intestatario: { cognome: "asc" } },
        { tipoEntrata: { nome: "asc" } },
      ],
    });

    return NextResponse.json(entrate);
  } catch (error) {
    console.error("Errore GET entrate:", error);
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
    const parsed = bulkUpsertEntrataSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verifica che gli intestatarioId appartengano all'utente corrente
    const uniqueIntIds = [...new Set(parsed.data.entrate.map((e) => e.intestatarioId))];
    const intestatariUtente = await prisma.intestatario.findMany({
      where: { id: { in: uniqueIntIds }, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    const intestatariConsentiti = new Set(intestatariUtente.map((i) => i.id));
    const entrateConsentite = parsed.data.entrate.filter((e) => intestatariConsentiti.has(e.intestatarioId));

    const results = await prisma.$transaction(
      entrateConsentite.map((entrata) =>
        prisma.entrata.upsert({
          where: {
            intestatarioId_tipoEntrataId_anno_mese: {
              intestatarioId: entrata.intestatarioId,
              tipoEntrataId: entrata.tipoEntrataId,
              anno: entrata.anno,
              mese: entrata.mese,
            },
          },
          update: {
            valore: parseFloat(entrata.valore),
            note: entrata.note ?? null,
          },
          create: {
            intestatarioId: entrata.intestatarioId,
            tipoEntrataId: entrata.tipoEntrataId,
            anno: entrata.anno,
            mese: entrata.mese,
            valore: parseFloat(entrata.valore),
            note: entrata.note ?? null,
          },
        })
      )
    );

    return NextResponse.json({ count: results.length }, { status: 200 });
  } catch (error) {
    console.error("Errore POST entrate:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
