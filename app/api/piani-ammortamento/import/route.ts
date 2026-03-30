import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

function parseCellValue(cell: ExcelJS.Cell): number | null {
  let rawVal = cell.value;
  if (rawVal === null || rawVal === undefined || rawVal === "") return null;

  if (typeof rawVal === "object" && rawVal !== null) {
    const obj = rawVal as unknown as Record<string, unknown>;
    if ("formula" in obj || "sharedFormula" in obj) {
      const formulaResult = obj.result;
      if (formulaResult === null || formulaResult === undefined || formulaResult === "") return null;
      if (typeof formulaResult === "object" && formulaResult !== null && "error" in (formulaResult as Record<string, unknown>)) {
        return null;
      }
      rawVal = formulaResult as unknown as typeof rawVal;
    } else if ("richText" in obj) {
      rawVal = (obj.richText as Array<{ text: string }>).map((r) => r.text).join("") as unknown as typeof rawVal;
    }
  }

  if (rawVal === null || rawVal === undefined || rawVal === "") return null;
  const valoreStr = typeof rawVal === "number" ? rawVal : String(rawVal).replace(",", ".");
  const valore = parseFloat(String(valoreStr));
  return isNaN(valore) ? null : valore;
}

function parseCellDate(cell: ExcelJS.Cell): Date | null {
  const rawVal = cell.value;
  if (rawVal === null || rawVal === undefined || rawVal === "") return null;

  // ExcelJS returns Date objects for date-formatted cells
  if (rawVal instanceof Date) {
    return rawVal;
  }

  // Try parsing string dates (DD/MM/YYYY)
  const text = cell.text?.trim();
  if (!text) return null;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = parseInt(match[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try ISO format
  const isoDate = new Date(String(rawVal));
  if (!isNaN(isoDate.getTime())) return isoDate;

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const nome = formData.get("nome") as string | null;
    const contoId = formData.get("contoId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Nessun file fornito" }, { status: 400 });
    }
    if (!nome?.trim()) {
      return NextResponse.json({ error: "Nome piano obbligatorio" }, { status: 400 });
    }
    if (!contoId?.trim()) {
      return NextResponse.json({ error: "Conto obbligatorio" }, { status: 400 });
    }

    // Verifica che il conto appartenga all'utente
    const conto = await prisma.conto.findFirst({
      where: { id: contoId, rapporto: { userId: session.user.id } },
    });
    if (!conto) {
      return NextResponse.json({ error: "Conto non trovato" }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(arrayBuffer);

    const sheet = workbook.getWorksheet("Piano Ammortamento");
    if (!sheet) {
      return NextResponse.json(
        { error: 'Foglio "Piano Ammortamento" non trovato. Usa il template originale.' },
        { status: 400 }
      );
    }

    const rate: { data: Date; quotaCapitale: number; quotaInteressi: number; rataTotale: number; debitoResiduo: number; contributo: number }[] = [];
    const errori: string[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const data = parseCellDate(row.getCell(1));
      if (!data) {
        errori.push(`Riga ${rowNumber}: data non valida`);
        return;
      }

      const quotaCapitale = parseCellValue(row.getCell(2));
      const quotaInteressi = parseCellValue(row.getCell(3));
      const rataTotale = parseCellValue(row.getCell(4));
      const debitoResiduo = parseCellValue(row.getCell(5));
      const contributo = parseCellValue(row.getCell(6));

      if (quotaCapitale === null || quotaInteressi === null || rataTotale === null || debitoResiduo === null) {
        errori.push(`Riga ${rowNumber}: valori obbligatori mancanti (quota capitale, interessi, rata totale, debito residuo)`);
        return;
      }

      rate.push({
        data,
        quotaCapitale,
        quotaInteressi,
        rataTotale,
        debitoResiduo,
        contributo: contributo ?? 0,
      });
    });

    if (rate.length === 0) {
      return NextResponse.json({ error: "Nessuna rata valida trovata nel file", errori }, { status: 400 });
    }

    const piano = await prisma.pianoAmmortamento.create({
      data: {
        nome: nome.trim(),
        contoId,
        userId: session.user.id,
        rate: {
          create: rate.map((r) => ({
            data: r.data,
            quotaCapitale: r.quotaCapitale,
            quotaInteressi: r.quotaInteressi,
            rataTotale: r.rataTotale,
            debitoResiduo: r.debitoResiduo,
            contributo: r.contributo,
          })),
        },
      },
      include: {
        rate: { orderBy: { data: "asc" } },
      },
    });

    return NextResponse.json({
      id: piano.id,
      count: piano.rate.length,
      errors: errori.length > 0 ? errori : undefined,
    });
  } catch (error) {
    console.error("Errore POST import piano ammortamento:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
