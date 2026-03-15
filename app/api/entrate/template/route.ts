import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const now = new Date();

    const startAnno = parseInt(searchParams.get("daAnno") ?? "2020");
    const startMese = parseInt(searchParams.get("daMese") ?? "1");
    const endAnno = parseInt(searchParams.get("aAnno") ?? now.getFullYear().toString());
    const endMese = parseInt(searchParams.get("aMese") ?? (now.getMonth() + 1).toString());

    const [intestatari, tipiEntrata] = await Promise.all([
      prisma.intestatario.findMany({
        where: { deletedAt: null },
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      }),
      prisma.tipoEntrata.findMany({
        where: { deletedAt: null },
        orderBy: { nome: "asc" },
      }),
    ]);

    const months: { anno: number; mese: number }[] = [];
    for (let anno = startAnno; anno <= endAnno; anno++) {
      const firstMese = anno === startAnno ? startMese : 1;
      const lastMese = anno === endAnno ? endMese : 12;
      for (let mese = firstMese; mese <= lastMese; mese++) {
        months.push({ anno, mese });
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Entrate Storiche");

    // Header: colonne fisse + colonne mese come date
    const fixedHeaders = ["intestatarioIds", "tipoEntrataId", "Intestatari", "Tipo Entrata"];
    const headerRow = sheet.addRow([
      ...fixedHeaders,
      ...months.map((m) => new Date(m.anno, m.mese - 1, 1)),
    ]);

    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8D4" } };

    // Colonne ID nascoste
    sheet.getColumn(1).hidden = true;
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).hidden = true;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 30;
    sheet.getColumn(4).width = 20;

    // Colonne mese: header in formato data MM/YYYY, celle dati in formato numerico
    for (let i = 5; i <= 4 + months.length; i++) {
      sheet.getColumn(i).width = 14;
      sheet.getColumn(i).numFmt = '#,##0.00';
      headerRow.getCell(i).numFmt = 'MM/YYYY';
    }

    // Tutti gli intestatari come stringa
    const allIds = intestatari.map((i) => i.id).join(",");
    const allNames = intestatari.map((i) => `${i.nome} ${i.cognome}`).join(", ");

    // Una riga per ogni tipo entrata (tutti gli intestatari di default)
    for (const tipo of tipiEntrata) {
      sheet.addRow([
        allIds,
        tipo.id,
        allNames,
        tipo.nome,
        ...months.map(() => null),
      ]);
    }

    sheet.views = [{ state: "frozen", xSplit: 4, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_entrate_storiche.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET template entrate:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
