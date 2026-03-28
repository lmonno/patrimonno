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
    const tuttiConti = await prisma.conto.findMany({
      where: { deletedAt: null, rapporto: { userId: session.user.id } },
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

    // Separa conti liquidi da tutti
    const conti = tuttiConti.filter((c) => c.liquido);

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

    // --- Patrimonio complessivo (tutti i conti, anche non liquidi) ---
    const tuttiContiConQuota = tuttiConti
      .map((conto) => {
        const intestatariIds = conto.intestatari.map((ci) => ci.intestatario.id);
        const totaleIntestatari = intestatariIds.length;
        if (totaleIntestatari === 0) return null;
        let quota: number;
        if (selectedIds) {
          const match = intestatariIds.filter((id) => selectedIds.includes(id)).length;
          if (match === 0) return null;
          quota = match / totaleIntestatari;
        } else {
          quota = 1;
        }
        return { conto, quota };
      })
      .filter(Boolean) as { conto: (typeof tuttiConti)[number]; quota: number }[];

    let patrimonioComplessivo = 0;
    for (const { conto, quota } of tuttiContiConQuota) {
      const saldo = conto.saldi.find((s) => s.anno === annoRif && s.mese === meseRif);
      if (saldo) {
        patrimonioComplessivo += Number(saldo.valore) * quota;
      }
    }

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

    const mesiConDati = storico.length;

    // Periodo 12 mesi per totaleFlussiStraordinari
    let mese12Fa = meseRif - 12;
    let anno12Fa = annoRif;
    while (mese12Fa <= 0) {
      mese12Fa += 12;
      anno12Fa -= 1;
    }
    let meseInizio = mese12Fa + 1;
    let annoInizio = anno12Fa;
    if (meseInizio > 12) {
      meseInizio = 1;
      annoInizio += 1;
    }
    const dataInizio = new Date(annoInizio, meseInizio - 1, 1);
    const dataFine = new Date(annoRif, meseRif, 0);
    const whereFlussi: Record<string, unknown> = {
      data: { gte: dataInizio, lte: dataFine },
      userId: session.user.id,
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
    let totaleFlussi = 0;
    if (selectedIds) {
      const numSelected = selectedIds.length;
      const tuttiIntestatari = await prisma.intestatario.findMany({
        where: { deletedAt: null, userId: session.user.id },
        select: { id: true },
      });
      const numTotaleIntestatari = tuttiIntestatari.length;
      for (const f of flussi) {
        if (f.intestatarioId === null) {
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

    // --- Risparmio dalla vista risparmio_spese ---
    type RisparmioRow = { intestatarioId: string; risparmio: number };

    // Risparmio ultimo mese
    const risparmioUltimoMeseRows = await prisma.$queryRaw<RisparmioRow[]>`
      SELECT "intestatarioId", risparmio
      FROM risparmio_spese
      WHERE anno = ${annoRif} AND mese = ${meseRif} AND "userId" = ${session.user.id}
    `;
    const righeUltimoMese = selectedIds
      ? risparmioUltimoMeseRows.filter((r) => selectedIds.includes(r.intestatarioId))
      : risparmioUltimoMeseRows;
    const risparmioUltimoMese = Math.round(
      righeUltimoMese.reduce((sum, r) => sum + Number(r.risparmio), 0) * 100
    ) / 100;

    // Risparmio medio mensile: somma risparmio 12 mesi / 12
    const startOrd = anno12Fa * 12 + mese12Fa + 1;
    const endOrd = annoRif * 12 + meseRif;
    const risparmio12Rows = await prisma.$queryRaw<RisparmioRow[]>`
      SELECT "intestatarioId", risparmio
      FROM risparmio_spese
      WHERE (anno * 12 + mese) >= ${startOrd} AND (anno * 12 + mese) <= ${endOrd} AND "userId" = ${session.user.id}
    `;
    const righe12Mesi = selectedIds
      ? risparmio12Rows.filter((r) => selectedIds.includes(r.intestatarioId))
      : risparmio12Rows;
    const risparmioMedioMensile = Math.round(
      (righe12Mesi.reduce((sum, r) => sum + Number(r.risparmio), 0) / 12) * 100
    ) / 100;

    return NextResponse.json({
      saldoAttuale: Math.round(saldoAttuale * 100) / 100,
      patrimonioComplessivo: Math.round(patrimonioComplessivo * 100) / 100,
      risparmioMedioMensile,
      risparmioUltimoMese,
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
