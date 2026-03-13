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

    // --- Saldo attuale: ultimo saldo disponibile per ogni conto ---
    let saldoAttuale = 0;
    for (const { conto, quota } of contiConQuota) {
      if (conto.saldi.length > 0) {
        // Saldi già ordinati desc, il primo è l'ultimo
        const ultimo = conto.saldi[0];
        saldoAttuale += Number(ultimo.valore) * quota;
      }
    }

    // --- Storico ultimi 12 mesi ---
    const now = new Date();
    let meseCorrente = now.getMonth(); // 0-based
    let annoCorrente = now.getFullYear();
    // Se siamo all'inizio del mese, consideriamo il mese precedente come corrente
    if (meseCorrente === 0) {
      meseCorrente = 12;
      annoCorrente -= 1;
    }

    // Genera lista ultimi 12 mesi (dal più vecchio al più recente)
    const periodi: { anno: number; mese: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      let m = meseCorrente - i;
      let a = annoCorrente;
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

    // --- Risparmio medio mensile ---
    let risparmioMedioMensile = 0;
    const mesiConDati = storico.length;
    if (storico.length >= 2) {
      const deltas: number[] = [];
      for (let i = 1; i < storico.length; i++) {
        deltas.push(storico[i].totale - storico[i - 1].totale);
      }
      risparmioMedioMensile =
        Math.round(
          (deltas.reduce((sum, d) => sum + d, 0) / deltas.length) * 100
        ) / 100;
    }

    return NextResponse.json({
      saldoAttuale: Math.round(saldoAttuale * 100) / 100,
      risparmioMedioMensile,
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
