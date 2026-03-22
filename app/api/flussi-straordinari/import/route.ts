import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

function extractCellValue(rawVal: ExcelJS.CellValue): string | number | Date | null {
  if (rawVal === null || rawVal === undefined || rawVal === "") return null;

  if (rawVal instanceof Date) {
    return rawVal;
  }

  if (typeof rawVal === "object" && rawVal !== null) {
    const obj = rawVal as unknown as Record<string, unknown>;
    if ("formula" in obj || "sharedFormula" in obj) {
      const result = obj.result;
      if (result === null || result === undefined || result === "") return null;
      if (typeof result === "object" && result !== null && "error" in (result as Record<string, unknown>)) {
        return null;
      }
      if (result instanceof Date) return result;
      return result as string | number;
    }
    if ("richText" in obj) {
      return (obj.richText as Array<{ text: string }>).map((r) => r.text).join("");
    }
  }

  return rawVal as string | number;
}

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

    const sheet = workbook.getWorksheet("Flussi Straordinari");
    if (!sheet) {
      return NextResponse.json(
        { error: 'Foglio "Flussi Straordinari" non trovato. Usa il template originale.' },
        { status: 400 }
      );
    }

    // Carica categorie e intestatari per il mapping per nome
    const [categorie, intestatari] = await Promise.all([
      prisma.categoriaFlusso.findMany({ where: { deletedAt: null } }),
      prisma.intestatario.findMany({ where: { deletedAt: null } }),
    ]);

    const categoriaByNome = new Map(categorie.map((c) => [c.nome.toLowerCase(), c.id]));
    const intestatarioByNome = new Map(
      intestatari.map((i) => [`${i.nome} ${i.cognome}`.toLowerCase(), i.id])
    );

    const flussiToCreate: {
      data: Date;
      importo: number;
      descrizione: string;
      categoriaId: string;
      intestatarioId: string | null;
      ammortizzare: boolean;
      mesiAmmortamento: number | null;
    }[] = [];
    const errori: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      // Colonna 1: Data
      const rawData = extractCellValue(row.getCell(1).value);
      if (!rawData) return; // Riga vuota

      let data: Date;
      if (rawData instanceof Date) {
        data = rawData;
      } else if (typeof rawData === "string") {
        // Prova formato DD/MM/YYYY
        const match = String(rawData).match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
        if (match) {
          data = new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
        } else {
          data = new Date(rawData);
        }
      } else {
        // Numero Excel (serial date)
        const excelEpoch = new Date(1899, 11, 30);
        data = new Date(excelEpoch.getTime() + (rawData as number) * 86400000);
      }

      if (isNaN(data.getTime())) {
        errori.push(`Riga ${rowNumber}: data non valida "${rawData}"`);
        return;
      }

      // Colonna 2: Importo
      const rawImporto = extractCellValue(row.getCell(2).value);
      if (rawImporto === null) {
        errori.push(`Riga ${rowNumber}: importo mancante`);
        return;
      }
      const importoStr = typeof rawImporto === "number" ? rawImporto : String(rawImporto).replace(",", ".");
      const importo = parseFloat(String(importoStr));
      if (isNaN(importo)) {
        errori.push(`Riga ${rowNumber}: importo non valido "${rawImporto}"`);
        return;
      }

      // Colonna 3: Descrizione
      const rawDesc = extractCellValue(row.getCell(3).value);
      const descrizione = rawDesc ? String(rawDesc).trim() : "";
      if (!descrizione) {
        errori.push(`Riga ${rowNumber}: descrizione mancante`);
        return;
      }

      // Colonna 4: Categoria
      const rawCat = extractCellValue(row.getCell(4).value);
      const catNome = rawCat ? String(rawCat).trim() : "";
      if (!catNome) {
        errori.push(`Riga ${rowNumber}: categoria mancante`);
        return;
      }
      const categoriaId = categoriaByNome.get(catNome.toLowerCase());
      if (!categoriaId) {
        errori.push(`Riga ${rowNumber}: categoria "${catNome}" non trovata`);
        return;
      }

      // Colonna 5: Pagante (opzionale, "Comune" o vuoto = null)
      const rawPagante = extractCellValue(row.getCell(5).value);
      let intestatarioId: string | null = null;
      if (rawPagante) {
        const paganteStr = String(rawPagante).trim().toLowerCase();
        if (paganteStr !== "comune" && paganteStr !== "") {
          const id = intestatarioByNome.get(paganteStr);
          if (!id) {
            errori.push(`Riga ${rowNumber}: pagante "${rawPagante}" non trovato`);
            return;
          }
          intestatarioId = id;
        }
      }

      // Colonna 6: Ammortizzare (opzionale, default No)
      const rawAmmort = extractCellValue(row.getCell(6).value);
      const ammortizzare = rawAmmort
        ? String(rawAmmort).trim().toLowerCase() === "sì" || String(rawAmmort).trim().toLowerCase() === "si"
        : false;

      // Colonna 7: Mesi Ammortamento (opzionale, default 12 se ammortizzare)
      let mesiAmmortamento: number | null = null;
      if (ammortizzare) {
        const rawMesi = extractCellValue(row.getCell(7).value);
        if (rawMesi !== null) {
          const mesi = parseInt(String(rawMesi));
          mesiAmmortamento = !isNaN(mesi) && mesi >= 1 ? mesi : 12;
        } else {
          mesiAmmortamento = 12;
        }
      }

      flussiToCreate.push({ data, importo, descrizione, categoriaId, intestatarioId, ammortizzare, mesiAmmortamento });
    });

    if (flussiToCreate.length === 0) {
      return NextResponse.json({ count: 0, errors: errori.length > 0 ? errori : undefined });
    }

    const results = await prisma.$transaction(
      flussiToCreate.map((f) =>
        prisma.flussoStraordinario.create({
          data: {
            data: f.data,
            importo: f.importo,
            descrizione: f.descrizione,
            categoriaId: f.categoriaId,
            intestatarioId: f.intestatarioId,
            ammortizzare: f.ammortizzare,
            mesiAmmortamento: f.mesiAmmortamento,
          },
        })
      )
    );

    return NextResponse.json({
      count: results.length,
      errors: errori.length > 0 ? errori : undefined,
    });
  } catch (error) {
    console.error("Errore POST import flussi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
