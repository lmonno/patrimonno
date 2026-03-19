import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bulkUpsertSaldoSchema } from "@/lib/validations/saldo";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const anno = searchParams.get("anno");
    const mese = searchParams.get("mese");
    const contoId = searchParams.get("contoId");

    const where: Record<string, unknown> = {};
    if (anno) where.anno = parseInt(anno);
    if (mese) where.mese = parseInt(mese);
    if (contoId) where.contoId = contoId;

    const saldi = await prisma.saldo.findMany({
      where,
      include: {
        conto: {
          select: {
            id: true,
            nome: true,
            deletedAt: true,
            rapporto: { select: { id: true, nome: true, istituto: true, iban: true } },
            tipoConto: { select: { id: true, nome: true } },
            intestatari: {
              include: {
                intestatario: { select: { id: true, nome: true, cognome: true } },
              },
            },
          },
        },
      },
      orderBy: [{ conto: { ordine: "asc" } }, { conto: { rapporto: { nome: "asc" } } }, { conto: { nome: "asc" } }],
    });

    return NextResponse.json(saldi);
  } catch (error) {
    console.error("Errore GET saldi:", error);
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
    const parsed = bulkUpsertSaldoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Dati non validi", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const results = await prisma.$transaction(
      parsed.data.saldi.map((saldo) =>
        prisma.saldo.upsert({
          where: {
            contoId_anno_mese: {
              contoId: saldo.contoId,
              anno: saldo.anno,
              mese: saldo.mese,
            },
          },
          update: {
            valore: parseFloat(saldo.valore),
            formula: saldo.formula ?? null,
          },
          create: {
            contoId: saldo.contoId,
            anno: saldo.anno,
            mese: saldo.mese,
            valore: parseFloat(saldo.valore),
            formula: saldo.formula ?? null,
          },
        })
      )
    );

    return NextResponse.json({ count: results.length }, { status: 200 });
  } catch (error) {
    console.error("Errore POST saldi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
