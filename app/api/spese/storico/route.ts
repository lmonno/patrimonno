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

    // Genera periodi: 48 mesi che terminano al mese di riferimento (36 + 12 per mediana mobile)
    // Plus 1 extra month before the first period for saldo precedente calculation
    const periodi: { anno: number; mese: number }[] = [];
    for (let i = 48; i >= 0; i--) {
      let m = meseRif - i;
      let a = annoRif;
      while (m <= 0) {
        m += 12;
        a -= 1;
      }
      periodi.push({ anno: a, mese: m });
    }
    // periodi[0] is the extra month before the 48 calculation months
    // periodi[1..48] are the 48 months we calculate spese for

    // --- Load all liquid conti with intestatari and saldi ---
    const contiLiquidi = await prisma.conto.findMany({
      where: { deletedAt: null, liquido: true },
      include: {
        intestatari: {
          include: {
            intestatario: { select: { id: true } },
          },
        },
        saldi: {
          orderBy: [{ anno: "desc" }, { mese: "desc" }],
        },
      },
    });

    // --- Load all entrate in the range (no tipoEntrata filter) ---
    const periodiCalcolo = periodi.slice(1); // 48 months
    const entrateWhereClause: Record<string, unknown> = {};
    if (selectedIds) {
      entrateWhereClause.intestatarioId = { in: selectedIds };
    }

    const entrate = await prisma.entrata.findMany({
      where: {
        ...entrateWhereClause,
        OR: periodiCalcolo.map((p) => ({ anno: p.anno, mese: p.mese })),
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

    // --- Load all flussi straordinari in the range ---
    const primoMese = periodiCalcolo[0];
    const ultimoMese = periodiCalcolo[periodiCalcolo.length - 1];
    const dataInizio = new Date(primoMese.anno, primoMese.mese - 1, 1);
    const dataFine = new Date(ultimoMese.anno, ultimoMese.mese, 0); // ultimo giorno

    const whereFlussi: Record<string, unknown> = {
      data: { gte: dataInizio, lte: dataFine },
    };
    if (selectedIds) {
      whereFlussi.OR = [
        { intestatarioId: { in: selectedIds } },
        { intestatarioId: null },
      ];
    }

    const flussi = await prisma.flussoStraordinario.findMany({
      where: whereFlussi,
      select: {
        data: true,
        importo: true,
        intestatarioId: true,
      },
    });

    // --- Load all intestatari for quota calculation of common flussi ---
    const tuttiIntestatari = await prisma.intestatario.findMany({
      where: { deletedAt: null },
      select: { id: true, nome: true, cognome: true },
    });
    const numTotaleIntestatari = tuttiIntestatari.length;

    // --- Build intestatari map from entrate + all intestatari ---
    const intestatariMap = new Map<string, string>();
    for (const e of entrate) {
      if (!intestatariMap.has(e.intestatario.id)) {
        intestatariMap.set(e.intestatario.id, `${e.intestatario.nome} ${e.intestatario.cognome}`);
      }
    }
    // Also add intestatari from conti (they may have saldi but no entrate)
    for (const conto of contiLiquidi) {
      for (const ci of conto.intestatari) {
        const intId = ci.intestatario.id;
        if (!intestatariMap.has(intId)) {
          const int = tuttiIntestatari.find((i) => i.id === intId);
          if (int) {
            intestatariMap.set(intId, `${int.nome} ${int.cognome}`);
          }
        }
      }
    }
    // If filtering by selectedIds, only keep those
    if (selectedIds) {
      for (const id of intestatariMap.keys()) {
        if (!selectedIds.includes(id)) {
          intestatariMap.delete(id);
        }
      }
    }

    // --- Aggregate entrate per month per intestatario ---
    const entratePerMeseInt = new Map<string, number>();
    for (const e of entrate) {
      const key = `${e.anno}-${e.mese}::${e.intestatario.id}`;
      entratePerMeseInt.set(key, (entratePerMeseInt.get(key) ?? 0) + Number(e.valore));
    }

    // --- Aggregate flussi straordinari per month per intestatario ---
    const flussiPerMeseInt = new Map<string, number>();
    for (const f of flussi) {
      const d = new Date(f.data);
      const fAnno = d.getFullYear();
      const fMese = d.getMonth() + 1;

      if (f.intestatarioId === null) {
        // Flusso comune: distribute proportionally
        if (selectedIds) {
          for (const id of selectedIds) {
            const key = `${fAnno}-${fMese}::${id}`;
            const quota = 1 / numTotaleIntestatari;
            flussiPerMeseInt.set(key, (flussiPerMeseInt.get(key) ?? 0) + Number(f.importo) * quota);
          }
        } else {
          // Distribute equally among all intestatari
          for (const int of tuttiIntestatari) {
            const key = `${fAnno}-${fMese}::${int.id}`;
            const quota = 1 / numTotaleIntestatari;
            flussiPerMeseInt.set(key, (flussiPerMeseInt.get(key) ?? 0) + Number(f.importo) * quota);
          }
        }
      } else {
        const key = `${fAnno}-${fMese}::${f.intestatarioId}`;
        flussiPerMeseInt.set(key, (flussiPerMeseInt.get(key) ?? 0) + Number(f.importo));
      }
    }

    // --- Calculate saldo liquido per intestatario per month ---
    // For each conto, determine quota per intestatario, then sum saldi
    const saldoPerMeseInt = new Map<string, number>();

    for (const conto of contiLiquidi) {
      const intestatariIds = conto.intestatari.map((ci) => ci.intestatario.id);
      const totaleIntestatari = intestatariIds.length;
      if (totaleIntestatari === 0) continue;

      // Determine which intestatari and their quota
      const quotePerIntestatario: { id: string; quota: number }[] = [];

      if (selectedIds) {
        for (const intId of intestatariIds) {
          if (selectedIds.includes(intId)) {
            quotePerIntestatario.push({ id: intId, quota: 1 / totaleIntestatari });
          }
        }
        if (quotePerIntestatario.length === 0) continue; // conto non pertinente
      } else {
        for (const intId of intestatariIds) {
          quotePerIntestatario.push({ id: intId, quota: 1 / totaleIntestatari });
        }
      }

      // For each period (including the extra month 0), add saldo contribution
      for (const periodo of periodi) {
        const saldo = conto.saldi.find(
          (s) => s.anno === periodo.anno && s.mese === periodo.mese
        );
        if (saldo) {
          const val = Number(saldo.valore);
          for (const { id, quota } of quotePerIntestatario) {
            const key = `${periodo.anno}-${periodo.mese}::${id}`;
            saldoPerMeseInt.set(key, (saldoPerMeseInt.get(key) ?? 0) + val * quota);
          }
        }
      }
    }

    // --- Calculate spese per month (48 months) ---
    const datiCompleti = periodiCalcolo.map((p, idx) => {
      const mesePrev = periodi[idx]; // periodi[0] for idx=0, which is the extra month
      const meseKey = `${p.anno}-${p.mese}`;
      const mesePrevKey = `${mesePrev.anno}-${mesePrev.mese}`;

      let totale = 0;
      const perIntestatario: Record<string, number> = {};

      for (const [intId] of intestatariMap) {
        const entrateInt = entratePerMeseInt.get(`${meseKey}::${intId}`) ?? 0;
        const saldoCorrente = saldoPerMeseInt.get(`${meseKey}::${intId}`) ?? 0;
        const saldoPrecedente = saldoPerMeseInt.get(`${mesePrevKey}::${intId}`) ?? 0;
        const deltaSaldo = saldoCorrente - saldoPrecedente;
        const flussiInt = flussiPerMeseInt.get(`${meseKey}::${intId}`) ?? 0;

        // Spese = Entrate - (ΔSaldo - Flussi straordinari)
        // = Entrate - ΔSaldo + Flussi straordinari
        const speseInt = entrateInt - deltaSaldo + flussiInt;

        perIntestatario[intId] = Math.round(speseInt * 100) / 100;
        totale += speseInt;
      }

      return {
        anno: p.anno,
        mese: p.mese,
        totale: Math.round(totale * 100) / 100,
        perIntestatario,
      };
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

    const intestatariNomi = Array.from(intestatariMap.entries()).map(([id, nome]) => ({ id, nome }));

    return NextResponse.json({ storico, intestatariNomi });
  } catch (error) {
    console.error("Errore GET spese/storico:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
