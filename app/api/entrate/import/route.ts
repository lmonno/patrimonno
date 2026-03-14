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

    const sheet = workbook.getWorksheet("Entrate Storiche");
    if (!sheet) {
      return NextResponse.json({ error: 'Foglio "Entrate Storiche" non trovato. Usa il template originale.' }, { status: 400 });
    }

    // Colonne fisse: 1=intestatarioId, 2=tipoEntrataId, 3=Intestatario, 4=Tipo Entrata
    const FIXED_COLS = 4;
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

    const entrateToUpsert: { intestatarioId: string; tipoEntrataId: string; anno: number; mese: number; valore: number }[] = [];
    const righeConErrore: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const intestatarioId = row.getCell(1).text?.trim();
      const tipoEntrataId = row.getCell(2).text?.trim();
      if (!intestatarioId || !tipoEntrataId) return;

      for (const { colIndex, anno, mese } of monthColumns) {
        const cell = row.getCell(colIndex);
        let rawVal = cell.value;
        if (rawVal === null || rawVal === undefined || rawVal === "") continue;

        // Gestione formule ExcelJS
        if (typeof rawVal === "object" && rawVal !== null) {
          const obj = rawVal as unknown as Record<string, unknown>;
          if ("formula" in obj || "sharedFormula" in obj) {
            const formulaResult = obj.result;
            if (formulaResult === null || formulaResult === undefined || formulaResult === "") continue;
            if (typeof formulaResult === "object" && formulaResult !== null && "error" in (formulaResult as Record<string, unknown>)) {
              righeConErrore.push(`Riga ${rowNumber}, ${String(mese).padStart(2, "0")}/${anno}: formula con errore "${(formulaResult as Record<string, unknown>).error}"`);
              continue;
            }
            rawVal = formulaResult as unknown as typeof rawVal;
          } else if ("richText" in obj) {
            rawVal = (obj.richText as Array<{ text: string }>).map((r) => r.text).join("") as unknown as typeof rawVal;
          }
        }
        if (rawVal === null || rawVal === undefined || rawVal === "") continue;

        const valoreStr = typeof rawVal === "number" ? rawVal : String(rawVal).replace(",", ".");
        const valore = parseFloat(String(valoreStr));

        if (isNaN(valore)) {
          righeConErrore.push(`Riga ${rowNumber}, ${String(mese).padStart(2, "0")}/${anno}: valore non numerico "${rawVal}"`);
          continue;
        }

        entrateToUpsert.push({ intestatarioId, tipoEntrataId, anno, mese, valore });
      }
    });

    if (entrateToUpsert.length === 0) {
      return NextResponse.json({ count: 0, errors: righeConErrore });
    }

    // Verifica intestatarioId e tipoEntrataId
    const uniqueIntIds = [...new Set(entrateToUpsert.map((e) => e.intestatarioId))];
    const uniqueTipoIds = [...new Set(entrateToUpsert.map((e) => e.tipoEntrataId))];

    const [intestatariEsistenti, tipiEsistenti] = await Promise.all([
      prisma.intestatario.findMany({ where: { id: { in: uniqueIntIds } }, select: { id: true } }),
      prisma.tipoEntrata.findMany({ where: { id: { in: uniqueTipoIds } }, select: { id: true } }),
    ]);

    const intSet = new Set(intestatariEsistenti.map((i: { id: string }) => i.id));
    const tipoSet = new Set(tipiEsistenti.map((t: { id: string }) => t.id));

    const entrateValide = entrateToUpsert.filter((e) => {
      if (!intSet.has(e.intestatarioId)) {
        righeConErrore.push(`Intestatario non trovato (id: ${e.intestatarioId})`);
        return false;
      }
      if (!tipoSet.has(e.tipoEntrataId)) {
        righeConErrore.push(`Tipo entrata non trovato (id: ${e.tipoEntrataId})`);
        return false;
      }
      return true;
    });

    const results = await prisma.$transaction(
      entrateValide.map((e) =>
        prisma.entrata.upsert({
          where: {
            intestatarioId_tipoEntrataId_anno_mese: {
              intestatarioId: e.intestatarioId,
              tipoEntrataId: e.tipoEntrataId,
              anno: e.anno,
              mese: e.mese,
            },
          },
          update: { valore: e.valore },
          create: {
            intestatarioId: e.intestatarioId,
            tipoEntrataId: e.tipoEntrataId,
            anno: e.anno,
            mese: e.mese,
            valore: e.valore,
          },
        })
      )
    );

    return NextResponse.json({
      count: results.length,
      errors: righeConErrore.length > 0 ? righeConErrore : undefined,
    });
  } catch (error) {
    console.error("Errore POST import entrate:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
