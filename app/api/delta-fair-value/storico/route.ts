import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type DeltaFVRow = {
  anno: number;
  mese: number;
  intestatarioId: string;
  intestatario_nome: string;
  delta_fair_value: number;
};

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

    const now = new Date();
    let defaultMese = now.getMonth();
    let defaultAnno = now.getFullYear();
    if (defaultMese === 0) {
      defaultMese = 12;
      defaultAnno -= 1;
    }
    const meseRif = parseInt(searchParams.get("mese") || String(defaultMese)) || defaultMese;
    const annoRif = parseInt(searchParams.get("anno") || String(defaultAnno)) || defaultAnno;

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

    const startOrd = periodi[0].anno * 12 + periodi[0].mese;
    const endOrd = annoRif * 12 + meseRif;

    const rows = await prisma.$queryRaw<DeltaFVRow[]>`
      SELECT anno, mese, "intestatarioId", intestatario_nome, delta_fair_value
      FROM delta_fair_value
      WHERE (anno * 12 + mese) >= ${startOrd} AND (anno * 12 + mese) <= ${endOrd} AND "userId" = ${session.user.id}
      ORDER BY anno, mese, "intestatarioId"
    `;

    const filteredRows = selectedIds
      ? rows.filter((r) => selectedIds.includes(r.intestatarioId))
      : rows;

    const intestatariMap = new Map<string, string>();
    for (const r of filteredRows) {
      if (!intestatariMap.has(r.intestatarioId)) {
        intestatariMap.set(r.intestatarioId, r.intestatario_nome);
      }
    }

    const meseMap = new Map<
      string,
      { anno: number; mese: number; totale: number; perIntestatario: Record<string, number> }
    >();
    for (const p of periodi) {
      meseMap.set(`${p.anno}-${p.mese}`, { anno: p.anno, mese: p.mese, totale: 0, perIntestatario: {} });
    }
    for (const r of filteredRows) {
      const entry = meseMap.get(`${r.anno}-${r.mese}`);
      if (!entry) continue;
      const delta = Number(r.delta_fair_value);
      entry.totale += delta;
      entry.perIntestatario[r.intestatarioId] = Math.round(delta * 100) / 100;
    }

    const datiCompleti = periodi.map((p) => {
      const entry = meseMap.get(`${p.anno}-${p.mese}`)!;
      return {
        anno: entry.anno,
        mese: entry.mese,
        totale: Math.round(entry.totale * 100) / 100,
        perIntestatario: entry.perIntestatario,
      };
    });

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

    const intestatariNomi = Array.from(intestatariMap.entries()).map(([id, nome]) => ({ id, nome }));

    return NextResponse.json({ storico, intestatariNomi });
  } catch (error) {
    console.error("Errore GET delta-fair-value/storico:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
