/**
 * Seed di sviluppo — genera dati di test realistici per 24 mesi.
 *
 * Eseguire DOPO il seed base:
 *   npx prisma db seed          # seed base (tipi, admin)
 *   npx tsx prisma/seed-dev.ts  # questo file
 */

import { PrismaClient, Ruolo } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Ritorna un Decimal-friendly number con 2 decimali */
function dec(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Variazione casuale ±pct% */
function vary(base: number, pct: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * (pct / 100);
  return dec(base * factor);
}

/** Genera i 24 mesi precedenti a partire da feb 2026 (incluso) andando indietro */
function ultimi24Mesi(): { anno: number; mese: number }[] {
  const mesi: { anno: number; mese: number }[] = [];
  // Da marzo 2024 a febbraio 2026
  for (let i = 0; i < 24; i++) {
    let m = 3 + i; // parte da marzo 2024
    let a = 2024;
    while (m > 12) {
      m -= 12;
      a += 1;
    }
    mesi.push({ anno: a, mese: m });
  }
  return mesi;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🔧 Avvio seed di sviluppo...\n");

  // ── 1. Utente di test ──────────────────────────────────────────────────
  const hashedPwd = await bcrypt.hash("test1234!", 12);
  try {
    const userTest = await prisma.user.upsert({
      where: { email: "test@family.local" },
      update: {},
      create: {
        nome: "Test",
        email: "test@family.local",
        hashedPassword: hashedPwd,
        ruolo: Ruolo.UTENTE,
      },
    });
    console.log(`✔ Utente test: ${userTest.email}`);
  } catch (err) {
    console.error("⚠ Errore creazione utente test:", err);
    console.log("  → Crea l'utente manualmente da Admin > Utenti");
  }

  // ── 2. Intestatari ────────────────────────────────────────────────────
  const intestatari = [
    { nome: "Marco", cognome: "Rossi" },
    { nome: "Laura", cognome: "Rossi" },
  ];

  const intestatariDb: { id: string; nome: string; cognome: string }[] = [];
  for (const int of intestatari) {
    // Cerca se esiste già (per rerunnabilità)
    let existing = await prisma.intestatario.findFirst({
      where: { nome: int.nome, cognome: int.cognome, deletedAt: null },
    });
    if (!existing) {
      existing = await prisma.intestatario.create({
        data: { nome: int.nome, cognome: int.cognome },
      });
    }
    intestatariDb.push({ id: existing.id, nome: existing.nome, cognome: existing.cognome });
  }
  const [marco, laura] = intestatariDb;
  console.log(`✔ Intestatari: ${intestatariDb.map((i) => `${i.nome} ${i.cognome}`).join(", ")}`);

  // ── 3. Lookup tipi ────────────────────────────────────────────────────
  const tipoCC = await prisma.tipoConto.findUniqueOrThrow({ where: { nome: "Conto Corrente" } });
  const tipoTitoli = await prisma.tipoConto.findUniqueOrThrow({ where: { nome: "Conto Titoli" } });
  const tipoDeposito = await prisma.tipoConto.findUniqueOrThrow({ where: { nome: "Conto Deposito" } });
  const tipoInvestimento = await prisma.tipoConto.findUniqueOrThrow({ where: { nome: "Investimento" } });
  const tipoFondoPensione = await prisma.tipoConto.findUniqueOrThrow({ where: { nome: "Fondo Pensione" } });

  const tipoStipendio = await prisma.tipoEntrata.findUniqueOrThrow({ where: { nome: "Stipendio" } });
  const tipoCedole = await prisma.tipoEntrata.findUniqueOrThrow({ where: { nome: "Cedole/Dividendi" } });
  const tipoContributi = await prisma.tipoEntrata.findUniqueOrThrow({ where: { nome: "Contributi" } });
  const tipoAffitto = await prisma.tipoEntrata.findUniqueOrThrow({ where: { nome: "Affitto" } });

  const catCasa = await prisma.categoriaFlusso.findUniqueOrThrow({ where: { nome: "Casa" } });
  const catAuto = await prisma.categoriaFlusso.findUniqueOrThrow({ where: { nome: "Auto" } });
  const catSalute = await prisma.categoriaFlusso.findUniqueOrThrow({ where: { nome: "Salute" } });
  const catViaggi = await prisma.categoriaFlusso.findUniqueOrThrow({ where: { nome: "Viaggi" } });
  const catRegali = await prisma.categoriaFlusso.findUniqueOrThrow({ where: { nome: "Regali" } });

  // ── 4. Rapporti e Conti ───────────────────────────────────────────────

  // Helper: crea rapporto + conti se non esistono
  async function creaRapportoConConti(
    rapporto: { nome: string; istituto: string; iban?: string; note?: string },
    conti: {
      nome: string;
      tipoContoId: string;
      liquido: boolean;
      intestatariIds: string[];
      ordine: number;
    }[]
  ) {
    let rap = await prisma.rapporto.findFirst({
      where: { nome: rapporto.nome, deletedAt: null },
    });
    if (!rap) {
      rap = await prisma.rapporto.create({ data: rapporto });
    }

    const contiDb: { id: string; nome: string; intestatariIds: string[] }[] = [];
    for (const c of conti) {
      let conto = await prisma.conto.findFirst({
        where: { rapportoId: rap.id, nome: c.nome, deletedAt: null },
      });
      if (!conto) {
        conto = await prisma.conto.create({
          data: {
            rapportoId: rap.id,
            nome: c.nome,
            tipoContoId: c.tipoContoId,
            liquido: c.liquido,
            ordine: c.ordine,
          },
        });
        // Intestatari
        for (const intId of c.intestatariIds) {
          await prisma.contoIntestatario.create({
            data: { contoId: conto.id, intestatarioId: intId },
          });
        }
      }
      contiDb.push({ id: conto.id, nome: conto.nome, intestatariIds: c.intestatariIds });
    }
    return contiDb;
  }

  // --- Intesa Sanpaolo (Marco) ---
  const contiIntesa = await creaRapportoConConti(
    { nome: "Intesa Sanpaolo - Marco", istituto: "Intesa Sanpaolo", iban: "IT60X0542811101000000123456" },
    [
      { nome: "C/C Principale", tipoContoId: tipoCC.id, liquido: true, intestatariIds: [marco.id], ordine: 1 },
      { nome: "Conto Titoli ISP", tipoContoId: tipoTitoli.id, liquido: false, intestatariIds: [marco.id], ordine: 2 },
    ]
  );
  console.log(`✔ Rapporto Intesa Sanpaolo: ${contiIntesa.length} conti`);

  // --- Fineco (Cointestato Marco + Laura) ---
  const contiFineco = await creaRapportoConConti(
    { nome: "Fineco - Famiglia", istituto: "FinecoBank", iban: "IT40S0301503200000003456789" },
    [
      { nome: "C/C Fineco", tipoContoId: tipoCC.id, liquido: true, intestatariIds: [marco.id, laura.id], ordine: 1 },
      { nome: "Fondi Fineco", tipoContoId: tipoInvestimento.id, liquido: false, intestatariIds: [marco.id, laura.id], ordine: 2 },
    ]
  );
  console.log(`✔ Rapporto Fineco: ${contiFineco.length} conti`);

  // --- ING (Laura) ---
  const contiIng = await creaRapportoConConti(
    { nome: "ING - Laura", istituto: "ING", iban: "IT15T0347501601CC0010000123" },
    [
      { nome: "Conto Arancio", tipoContoId: tipoDeposito.id, liquido: true, intestatariIds: [laura.id], ordine: 1 },
    ]
  );
  console.log(`✔ Rapporto ING: ${contiIng.length} conto`);

  // --- Amundi (Marco - Fondo Pensione) ---
  const contiAmundi = await creaRapportoConConti(
    { nome: "Amundi SecondaPensione", istituto: "Amundi", note: "Linea bilanciata" },
    [
      { nome: "Fondo Pensione Marco", tipoContoId: tipoFondoPensione.id, liquido: false, intestatariIds: [marco.id], ordine: 1 },
    ]
  );
  console.log(`✔ Rapporto Amundi: ${contiAmundi.length} conto`);

  // ── 5. Saldi (24 mesi) ───────────────────────────────────────────────
  const mesi = ultimi24Mesi();

  // Definisci andamento per ogni conto
  const andamentoSaldi: {
    contoId: string;
    base: number;
    crescitaMensile: number; // importo medio mensile di crescita
    volatilita: number; // % di variazione casuale
  }[] = [
    // C/C Marco: stipendio in, spese out → cresce lentamente
    { contoId: contiIntesa[0].id, base: 8500, crescitaMensile: 150, volatilita: 15 },
    // Titoli ISP Marco: investimenti, crescita moderata
    { contoId: contiIntesa[1].id, base: 45000, crescitaMensile: 300, volatilita: 5 },
    // C/C Fineco cointestato: spese famiglia
    { contoId: contiFineco[0].id, base: 5200, crescitaMensile: 50, volatilita: 20 },
    // Fondi Fineco: investimenti famiglia
    { contoId: contiFineco[1].id, base: 32000, crescitaMensile: 250, volatilita: 4 },
    // Conto Arancio Laura: deposito stabile
    { contoId: contiIng[0].id, base: 15000, crescitaMensile: 200, volatilita: 5 },
    // Fondo Pensione Marco: contributi regolari
    { contoId: contiAmundi[0].id, base: 28000, crescitaMensile: 350, volatilita: 3 },
  ];

  let saldiCreati = 0;
  for (const { contoId, base, crescitaMensile, volatilita } of andamentoSaldi) {
    let valore = base;
    for (const { anno, mese } of mesi) {
      valore = dec(valore + vary(crescitaMensile, volatilita * 3));
      // Assicura che non vada sotto il 60% del base
      if (valore < base * 0.6) valore = dec(base * 0.6 + Math.random() * base * 0.1);

      await prisma.saldo.upsert({
        where: { contoId_anno_mese: { contoId, anno, mese } },
        update: { valore },
        create: { contoId, anno, mese, valore },
      });
      saldiCreati++;
    }
  }
  console.log(`✔ Saldi creati/aggiornati: ${saldiCreati}`);

  // ── 6. Entrate (24 mesi) ──────────────────────────────────────────────
  const entrateConfig: {
    intestatarioId: string;
    tipoEntrataId: string;
    base: number;
    volatilita: number;
    frequenza: "mensile" | "trimestrale" | "semestrale";
  }[] = [
    // Marco: stipendio fisso
    { intestatarioId: marco.id, tipoEntrataId: tipoStipendio.id, base: 2800, volatilita: 2, frequenza: "mensile" },
    // Marco: contributi TFR
    { intestatarioId: marco.id, tipoEntrataId: tipoContributi.id, base: 250, volatilita: 0, frequenza: "mensile" },
    // Laura: stipendio
    { intestatarioId: laura.id, tipoEntrataId: tipoStipendio.id, base: 2200, volatilita: 2, frequenza: "mensile" },
    // Marco: cedole semestrali (giugno e dicembre)
    { intestatarioId: marco.id, tipoEntrataId: tipoCedole.id, base: 850, volatilita: 10, frequenza: "semestrale" },
    // Laura: affitto trimestrale
    { intestatarioId: laura.id, tipoEntrataId: tipoAffitto.id, base: 1200, volatilita: 0, frequenza: "trimestrale" },
  ];

  let entrateCreate = 0;
  for (const { intestatarioId, tipoEntrataId, base, volatilita, frequenza } of entrateConfig) {
    for (const { anno, mese } of mesi) {
      // Controlla frequenza
      if (frequenza === "trimestrale" && mese % 3 !== 0) continue;
      if (frequenza === "semestrale" && mese !== 6 && mese !== 12) continue;

      const valore = vary(base, volatilita);

      await prisma.entrata.upsert({
        where: {
          intestatarioId_tipoEntrataId_anno_mese: {
            intestatarioId,
            tipoEntrataId,
            anno,
            mese,
          },
        },
        update: { valore },
        create: { intestatarioId, tipoEntrataId, anno, mese, valore },
      });
      entrateCreate++;
    }
  }
  console.log(`✔ Entrate create/aggiornate: ${entrateCreate}`);

  // ── 7. Flussi Straordinari ────────────────────────────────────────────
  const flussiDati: {
    data: Date;
    importo: number;
    descrizione: string;
    categoriaId: string;
    intestatarioId: string | null;
  }[] = [
    // Ristrutturazione bagno (negativo, spesa comune)
    { data: new Date(2024, 4, 15), importo: -8500, descrizione: "Ristrutturazione bagno", categoriaId: catCasa.id, intestatarioId: null },
    // Acquisto auto Laura
    { data: new Date(2024, 7, 3), importo: -18000, descrizione: "Acquisto Fiat 500e", categoriaId: catAuto.id, intestatarioId: laura.id },
    // Bonus aziendale Marco
    { data: new Date(2024, 11, 20), importo: 3200, descrizione: "Bonus annuale azienda", categoriaId: catRegali.id, intestatarioId: marco.id },
    // Viaggio famiglia estate 2025
    { data: new Date(2025, 6, 10), importo: -3800, descrizione: "Vacanza Grecia 2025", categoriaId: catViaggi.id, intestatarioId: null },
    // Intervento dentistico Marco
    { data: new Date(2025, 2, 8), importo: -1500, descrizione: "Impianto dentale", categoriaId: catSalute.id, intestatarioId: marco.id },
    // Eredità Laura
    { data: new Date(2025, 4, 1), importo: 12000, descrizione: "Eredità zia Maria", categoriaId: catRegali.id, intestatarioId: laura.id },
    // Manutenzione auto Marco
    { data: new Date(2025, 8, 22), importo: -950, descrizione: "Tagliando + gomme invernali", categoriaId: catAuto.id, intestatarioId: marco.id },
    // Caldaia nuova (comune)
    { data: new Date(2025, 10, 5), importo: -3200, descrizione: "Sostituzione caldaia", categoriaId: catCasa.id, intestatarioId: null },
    // Viaggio Natale 2025
    { data: new Date(2025, 11, 28), importo: -2100, descrizione: "Settimana bianca Dolomiti", categoriaId: catViaggi.id, intestatarioId: null },
    // Visita specialistica Laura
    { data: new Date(2026, 0, 15), importo: -320, descrizione: "Visita ortopedica + risonanza", categoriaId: catSalute.id, intestatarioId: laura.id },
    // Riparazione tetto (comune)
    { data: new Date(2026, 1, 10), importo: -4500, descrizione: "Riparazione infiltrazione tetto", categoriaId: catCasa.id, intestatarioId: null },
  ];

  let flussiCreati = 0;
  for (const f of flussiDati) {
    // Evita duplicati: cerca per data + descrizione
    const existing = await prisma.flussoStraordinario.findFirst({
      where: { data: f.data, descrizione: f.descrizione },
    });
    if (!existing) {
      await prisma.flussoStraordinario.create({ data: f });
      flussiCreati++;
    }
  }
  console.log(`✔ Flussi straordinari creati: ${flussiCreati}`);

  // ── Riepilogo ─────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  SEED DI SVILUPPO COMPLETATO");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Intestatari:  ${intestatariDb.length} (Marco Rossi, Laura Rossi)`);
  console.log(`  Rapporti:     4 (Intesa, Fineco, ING, Amundi)`);
  console.log(`  Conti:        6 (4 liquidi + 2 investimento)`);
  console.log(`  Saldi:        ${saldiCreati} (24 mesi × 6 conti)`);
  console.log(`  Entrate:      ${entrateCreate} (stipendi, cedole, affitto, contributi)`);
  console.log(`  Flussi:       ${flussiDati.length} (spese/entrate straordinarie)`);
  console.log("═══════════════════════════════════════════════════");
  console.log("\n  Login test:   test@family.local / test1234!");
  console.log("  Login admin:  admin@family.local / admin123!\n");
}

main()
  .catch((e) => {
    console.error("Errore seed-dev:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
