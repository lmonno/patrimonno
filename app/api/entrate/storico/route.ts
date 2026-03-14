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

    // Genera periodi: 24 mesi che terminano al mese di riferimento (per avere 12 mesi di mediana mobile)
    const periodi: { anno: number; mese: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      let m = meseRif - i;
      let a = annoRif;
      while (m <= 0) {
        m += 12;
        a -= 1;
      }
      periodi.push({ anno: a, mese: m });
    }

    // Filtro intestatari
    const whereIntestatario = selectedIds
      ? { intestatarioId: { in: selectedIds } }
      : {};

    // Carica tutte le entrate nel range
    const primoP = periodi[0];
    const ultimoP = periodi[periodi.length - 1];
    const entrate = await prisma.entrata.findMany({
      where: {
        ...whereIntestatario,
        OR: periodi.map((p) => ({ anno: p.anno, mese: p.mese })),
      },
      select: {
        anno: true,
        mese: true,
        valore: true,
      },
    });

    // Aggrega per mese
    const mapMensile = new Map<string, number>();
    for (const e of entrate) {
      const key = `${e.anno}-${e.mese}`;
      mapMensile.set(key, (mapMensile.get(key) ?? 0) + Number(e.valore));
    }

    // Costruisci array con totali (0 se mese senza dati)
    const datiCompleti = periodi.map((p) => ({
      anno: p.anno,
      mese: p.mese,
      totale: Math.round((mapMensile.get(`${p.anno}-${p.mese}`) ?? 0) * 100) / 100,
    }));

    // Calcola mediana mobile a 12 mesi (solo per ultimi 12 mesi)
    const storico = datiCompleti.slice(12).map((punto, i) => {
      // Finestra: 12 mesi che terminano a questo mese (incluso)
      const finestra = datiCompleti.slice(i, i + 12).map((d) => d.totale);
      // Mediana
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
      };
    });

    return NextResponse.json({ storico });
  } catch (error) {
    console.error("Errore GET entrate/storico:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
