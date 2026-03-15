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
    let defaultMese = now.getMonth(); // 0-based, quindi getMonth() = mese precedente in 1-based
    let defaultAnno = now.getFullYear();
    if (defaultMese === 0) {
      defaultMese = 12;
      defaultAnno -= 1;
    }
    const meseRif = parseInt(searchParams.get("mese") || String(defaultMese)) || defaultMese;
    const annoRif = parseInt(searchParams.get("anno") || String(defaultAnno)) || defaultAnno;

    // Carica tutti i conti attivi con intestatari e saldi
    const conti = await prisma.conto.findMany({
      where: { deletedAt: null },
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

    // Per ogni conto calcola la quota in base al filtro intestatari
    const contiConQuota = conti
      .map((conto) => {
        const intestatariIds = conto.intestatari.map(
          (ci) => ci.intestatario.id
        );
        const totaleIntestatari = intestatariIds.length;
        if (totaleIntestatari === 0) return null;

        let quota: number;
        if (selectedIds) {
          // Quanti degli intestatari selezionati sono in questo conto
          const match = intestatariIds.filter((id) =>
            selectedIds.includes(id)
          ).length;
          if (match === 0) return null; // conto non pertinente
          quota = match / totaleIntestatari;
        } else {
          // Tutti: quota piena
          quota = 1;
        }

        return { conto, quota };
      })
      .filter(Boolean) as { conto: (typeof conti)[number]; quota: number }[];

    // --- Saldo al mese di riferimento: somma saldi del mese selezionato ---
    let saldoAttuale = 0;
    for (const { conto, quota } of contiConQuota) {
      const saldo = conto.saldi.find(
        (s) => s.anno === annoRif && s.mese === meseRif
      );
      if (saldo) {
        saldoAttuale += Number(saldo.valore) * quota;
      }
    }

    // --- Storico 12 mesi che terminano al mese di riferimento ---
    const periodi: { anno: number; mese: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = meseRif - i;
      let a = annoRif;
      while (m <= 0) {
        m += 12;
        a -= 1;
      }
      periodi.push({ anno: a, mese: m });
    }

    // Per ogni periodo, somma i saldi dei conti (con quota)
    const storico: { anno: number; mese: number; totale: number }[] = [];
    for (const periodo of periodi) {
      let totale = 0;
      let haDati = false;
      for (const { conto, quota } of contiConQuota) {
        const saldo = conto.saldi.find(
          (s) => s.anno === periodo.anno && s.mese === periodo.mese
        );
        if (saldo) {
          totale += Number(saldo.valore) * quota;
          haDati = true;
        }
      }
      if (haDati) {
        storico.push({
          anno: periodo.anno,
          mese: periodo.mese,
          totale: Math.round(totale * 100) / 100,
        });
      }
    }

    // --- Risparmio medio mensile: (saldo attuale - saldo 12 mesi fa - flussi straordinari) / 12 ---
    let risparmioMedioMensile = 0;
    const mesiConDati = storico.length;
    const meseSelezionato = storico.find(
      (s) => s.anno === annoRif && s.mese === meseRif
    );
    // Cerco il saldo di esattamente 12 mesi prima
    let mese12Fa = meseRif - 12;
    let anno12Fa = annoRif;
    while (mese12Fa <= 0) {
      mese12Fa += 12;
      anno12Fa -= 1;
    }
    const dodiciMesiFa = storico.find(
      (s) => s.anno === anno12Fa && s.mese === mese12Fa
    );

    // Flussi straordinari nel periodo (dal mese dopo il mese 12fa fino al mese di riferimento incluso)
    // Range: dal giorno 1 del mese successivo a 12 mesi fa, fino all'ultimo giorno del mese di riferimento
    let meseInizio = mese12Fa + 1;
    let annoInizio = anno12Fa;
    if (meseInizio > 12) {
      meseInizio = 1;
      annoInizio += 1;
    }
    const dataInizio = new Date(annoInizio, meseInizio - 1, 1); // primo giorno del mese dopo 12fa
    const dataFine = new Date(annoRif, meseRif, 0); // ultimo giorno del mese di riferimento

    // Filtro flussi per intestatari selezionati (null = comune, incluso sempre)
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
      select: { importo: true, intestatarioId: true },
    });

    // Somma flussi (quelli "comuni" contano al 100% se filtro Tutti,
    // oppure quota proporzionale se filtro per intestatari)
    let totaleFlussi = 0;
    if (selectedIds) {
      const numSelected = selectedIds.length;
      // Carica tutti gli intestatari attivi per calcolare la quota dei flussi comuni
      const tuttiIntestatari = await prisma.intestatario.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      const numTotaleIntestatari = tuttiIntestatari.length;
      for (const f of flussi) {
        if (f.intestatarioId === null) {
          // Flusso comune: quota proporzionale
          totaleFlussi += Number(f.importo) * (numSelected / numTotaleIntestatari);
        } else {
          totaleFlussi += Number(f.importo);
        }
      }
    } else {
      for (const f of flussi) {
        totaleFlussi += Number(f.importo);
      }
    }

    if (meseSelezionato) {
      const totale12Fa = dodiciMesiFa?.totale ?? 0;
      risparmioMedioMensile =
        Math.round(((meseSelezionato.totale - totale12Fa - totaleFlussi) / 12) * 100) / 100;
    }

    return NextResponse.json({
      saldoAttuale: Math.round(saldoAttuale * 100) / 100,
      risparmioMedioMensile,
      totaleFlussiStraordinari: Math.round(totaleFlussi * 100) / 100,
      mesiConDati,
      storico,
    });
  } catch (error) {
    console.error("Errore GET patrimonio:", error);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
