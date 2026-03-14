import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Nessun file fornito" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet = workbook.getWorksheet("Saldi Storici");
    if (!sheet) {
      return NextResponse.json({ error: 'Foglio "Saldi Storici" non trovato. Usa il template originale.' }, { status: 400 });
    }

    // Leggi intestazioni per identificare le colonne mese (formato MM/YYYY)
    const FIXED_COLS = 6;
    const monthColumns: { colIndex: number; anno: number; mese: number }[] = [];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      if (colNumber <= FIXED_COLS) return;
      const val = cell.text?.trim();
      if (!val) return;
      const match = val.match(/^(\d{2})\/(\d{4})$/);
      if (match) {
        monthColumns.push({
          colIndex: colNumber,
          mese: parseInt(match[1]),
          anno: parseInt(match[2]),
        });
      }
    });

    if (monthColumns.length === 0) {
      return NextResponse.json({ error: "Nessuna colonna mese trovata nel file." }, { status: 400 });
    }

    const saldiToUpsert: { contoId: string; anno: number; mese: number; valore: number }[] = [];
    const righeConErrore: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const contoId = row.getCell(1).text?.trim();
      if (!contoId) return;

      for (const { colIndex, anno, mese } of monthColumns) {
        const cell = row.getCell(colIndex);
        let rawVal = cell.value;
        if (rawVal === null || rawVal === undefined || rawVal === "") continue;

        // ExcelJS restituisce un oggetto per le celle con formula/sharedFormula
        if (typeof rawVal === "object" && rawVal !== null) {
          const obj = rawVal as Record<string, unknown>;
          if ("formula" in obj || "sharedFormula" in obj) {
            // Cella con formula: usa il risultato calcolato
            rawVal = obj.result ?? null;
            // Gestisci errori di formula (es. #REF!, #N/A, #VALUE!)
            if (typeof rawVal === "object" && rawVal !== null && "error" in (rawVal as Record<string, unknown>)) {
              righeConErrore.push(`Riga ${rowNumber}, ${String(mese).padStart(2, "0")}/${anno}: formula con errore "${(rawVal as Record<string, unknown>).error}"`);
              continue;
            }
          } else if ("richText" in obj) {
            // Cella con rich text: estrai il testo
            rawVal = (obj.richText as Array<{ text: string }>).map((r) => r.text).join("");
          }
        }
        if (rawVal === null || rawVal === undefined || rawVal === "") continue;

        const valoreStr = typeof rawVal === "number" ? rawVal : String(rawVal).replace(",", ".");
        const valore = parseFloat(String(valoreStr));

        if (isNaN(valore)) {
          righeConErrore.push(`Riga ${rowNumber}, ${String(mese).padStart(2, "0")}/${anno}: valore non numerico "${rawVal}"`);
          continue;
        }

        saldiToUpsert.push({ contoId, anno, mese, valore });
      }
    });

    if (saldiToUpsert.length === 0) {
      return NextResponse.json({ count: 0, errors: righeConErrore });
    }

    // Verifica che i contoId esistano
    const uniqueContoIds = [...new Set(saldiToUpsert.map((s) => s.contoId))];
    const contiEsistenti = await prisma.conto.findMany({
      where: { id: { in: uniqueContoIds } },
      select: { id: true },
    });
    const contiSet = new Set(contiEsistenti.map((c: { id: string }) => c.id));

    const saldiValidi = saldiToUpsert.filter((s) => {
      if (!contiSet.has(s.contoId)) {
        righeConErrore.push(`Conto non trovato (id: ${s.contoId})`);
        return false;
      }
      return true;
    });

    const results = await prisma.$transaction(
      saldiValidi.map((s) =>
        prisma.saldo.upsert({
          where: { contoId_anno_mese: { contoId: s.contoId, anno: s.anno, mese: s.mese } },
          update: { valore: s.valore },
          create: { contoId: s.contoId, anno: s.anno, mese: s.mese, valore: s.valore },
        })
      )
    );

    return NextResponse.json({
      count: results.length,
      errors: righeConErrore.length > 0 ? righeConErrore : undefined,
    });
  } catch (error) {
    console.error("Errore POST import saldi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
