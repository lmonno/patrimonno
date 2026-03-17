import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const intestatariIdsParam = searchParams.get("intestatariIds");
    const selectedIds = intestatariIdsParam
      ? intestatariIdsParam.split(",").filter(Boolean)
      : null;

    const tipoEntrataIdsParam = searchParams.get("tipoEntrataIds");
    const selectedTipoIds = tipoEntrataIdsParam
      ? tipoEntrataIdsParam.split(",").filter(Boolean)
      : null;

    // Mese di riferimento (default: mese precedente)
    const now = new Date();
    let defaultMese = now.getMonth();
    let defaultAnno = now.getFullYear();
    if (defaultMese === 0) {
      defaultMese = 12;
      defaultAnno -= 1;
    }
    const meseRif = parseInt(searchParams.get("mese") || String(defaultMese)) || defaultMese;
    const annoRif = parseInt(searchParams.get("anno") || String(defaultAnno)) || defaultAnno;

    // Genera periodi: 48 mesi che terminano al mese di riferimento (36 mesi + 12 per mediana mobile)
    const periodi: { anno: number; mese: number }[] = [];
    for (let i = 47; i >= 0; i--) {
      let m = meseRif - i;
      let a = annoRif;
      while (m <= 0) {
        m += 12;
        a -= 1;
      }
      periodi.push({ anno: a, mese: m });
    }

    // Filtri
    const whereClause: Record<string, unknown> = {};
    if (selectedIds) {
      whereClause.intestatarioId = { in: selectedIds };
    }
    if (selectedTipoIds) {
      whereClause.tipoEntrataId = { in: selectedTipoIds };
    }

    // Carica tutte le entrate nel range con intestatario
    const entrate = await prisma.entrata.findMany({
      where: {
        ...whereClause,
        OR: periodi.map((p) => ({ anno: p.anno, mese: p.mese })),
      },
      select: {
        anno: true,
        mese: true,
        valore: true,
        intestatario: {
          select: { id: true, nome: true, cognome: true },
        },
      },
    });

    // Mappa intestatari presenti
    const intestatariMap = new Map<string, string>();
    for (const e of entrate) {
      const chiave = e.intestatario.id;
      if (!intestatariMap.has(chiave)) {
        intestatariMap.set(chiave, `${e.intestatario.nome} ${e.intestatario.cognome}`);
      }
    }
    const intestatariNomi = Array.from(intestatariMap.entries()).map(([id, nome]) => ({ id, nome }));

    // Aggrega per mese e intestatario
    const mapPerIntestatario = new Map<string, number>();
    const mapTotale = new Map<string, number>();
    for (const e of entrate) {
      const meseKey = `${e.anno}-${e.mese}`;
      const intKey = `${meseKey}::${e.intestatario.id}`;
      const val = Number(e.valore);
      mapPerIntestatario.set(intKey, (mapPerIntestatario.get(intKey) ?? 0) + val);
      mapTotale.set(meseKey, (mapTotale.get(meseKey) ?? 0) + val);
    }

    // Costruisci dati completi (48 mesi)
    const datiCompleti = periodi.map((p) => {
      const meseKey = `${p.anno}-${p.mese}`;
      const totale = Math.round((mapTotale.get(meseKey) ?? 0) * 100) / 100;
      const perIntestatario: Record<string, number> = {};
      for (const [id] of intestatariMap) {
        const val = mapPerIntestatario.get(`${meseKey}::${id}`) ?? 0;
        perIntestatario[id] = Math.round(val * 100) / 100;
      }
      return { anno: p.anno, mese: p.mese, totale, perIntestatario };
    });

    // Calcola mediana mobile a 12 mesi (ultimi 36 mesi)
    const storico = datiCompleti.slice(12).map((punto, i) => {
      const finestra = datiCompleti.slice(i, i + 12).map((d) => d.totale);
      const sorted = [...finestra].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const mediana =
        sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

      return {
        anno: punto.anno,
        mese: punto.mese,
        totale: punto.totale,
        mediana: Math.round(mediana * 100) / 100,
        perIntestatario: punto.perIntestatario,
      };
    });

    return NextResponse.json({ storico, intestatariNomi });
  } catch (error) {
    console.error("Errore GET entrate/storico:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
