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

    // Formato verticale (unpivot):
    // Col 1: intestatarioIds, Col 2: tipoEntrataId, Col 3: Intestatari, Col 4: Tipo Entrata, Col 5: Mese (data), Col 6: Valore

    const entrateToUpsert: { intestatarioId: string; tipoEntrataId: string; anno: number; mese: number; valore: number }[] = [];
    const righeConErrore: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const intestatarioIdsRaw = row.getCell(1).text?.trim();
      const tipoEntrataId = row.getCell(2).text?.trim();
      if (!intestatarioIdsRaw || !tipoEntrataId) return;

      const intestatarioIds = intestatarioIdsRaw.split(",").map((id) => id.trim()).filter(Boolean);
      if (intestatarioIds.length === 0) return;

      // Colonna 5: Mese (data)
      const meseCell = row.getCell(5);
      const meseRaw = meseCell.value;
      let anno: number | null = null;
      let mese: number | null = null;

      if (meseRaw instanceof Date) {
        anno = meseRaw.getFullYear();
        mese = meseRaw.getMonth() + 1;
      } else {
        const meseText = meseCell.text?.trim();
        if (meseText) {
          const match = meseText.match(/^(\d{2})\/(\d{4})$/);
          if (match) {
            mese = parseInt(match[1]);
            anno = parseInt(match[2]);
          }
        }
      }

      if (anno === null || mese === null) {
        righeConErrore.push(`Riga ${rowNumber}: mese non valido "${meseCell.text}"`);
        return;
      }

      // Colonna 6: Valore
      const valoreCell = row.getCell(6);
      let rawVal = valoreCell.value;
      if (rawVal === null || rawVal === undefined || rawVal === "") return;

      // Gestione formule ExcelJS
      if (typeof rawVal === "object" && rawVal !== null) {
        const obj = rawVal as unknown as Record<string, unknown>;
        if ("formula" in obj || "sharedFormula" in obj) {
          const formulaResult = obj.result;
          if (formulaResult === null || formulaResult === undefined || formulaResult === "") return;
          if (typeof formulaResult === "object" && formulaResult !== null && "error" in (formulaResult as Record<string, unknown>)) {
            righeConErrore.push(`Riga ${rowNumber}, ${String(mese).padStart(2, "0")}/${anno}: formula con errore "${(formulaResult as Record<string, unknown>).error}"`);
            return;
          }
          rawVal = formulaResult as unknown as typeof rawVal;
        } else if ("richText" in obj) {
          rawVal = (obj.richText as Array<{ text: string }>).map((r) => r.text).join("") as unknown as typeof rawVal;
        }
      }
      if (rawVal === null || rawVal === undefined || rawVal === "") return;

      const valoreStr = typeof rawVal === "number" ? rawVal : String(rawVal).replace(",", ".");
      const valoreTotale = parseFloat(String(valoreStr));

      if (isNaN(valoreTotale)) {
        righeConErrore.push(`Riga ${rowNumber}, ${String(mese).padStart(2, "0")}/${anno}: valore non numerico "${rawVal}"`);
        return;
      }

      // Dividi il valore equamente tra gli intestatari
      const valorePerIntestatario = Math.round((valoreTotale / intestatarioIds.length) * 100) / 100;
      for (const intestatarioId of intestatarioIds) {
        entrateToUpsert.push({ intestatarioId, tipoEntrataId, anno, mese, valore: valorePerIntestatario });
      }
    });

    if (entrateToUpsert.length === 0) {
      return NextResponse.json({ count: 0, errors: righeConErrore });
    }

    // Verifica intestatarioId e tipoEntrataId
    const uniqueIntIds = [...new Set(entrateToUpsert.map((e) => e.intestatarioId))];
    const uniqueTipoIds = [...new Set(entrateToUpsert.map((e) => e.tipoEntrataId))];

    const [intestatariEsistenti, tipiEsistenti] = await Promise.all([
      prisma.intestatario.findMany({ where: { id: { in: uniqueIntIds }, userId: session.user.id }, select: { id: true } }),
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

    if (entrateValide.length === 0) {
      return NextResponse.json({
        error: "Nessuna entrata valida da importare",
        count: 0,
        errors: righeConErrore.length > 0 ? righeConErrore : undefined,
      }, { status: 400 });
    }

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
