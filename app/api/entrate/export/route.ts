import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const entrate = await prisma.entrata.findMany({
      include: {
        intestatario: { select: { id: true, nome: true, cognome: true } },
        tipoEntrata: { select: { id: true, nome: true } },
      },
      orderBy: [
        { intestatario: { cognome: "asc" } },
        { tipoEntrata: { nome: "asc" } },
        { anno: "asc" },
        { mese: "asc" },
      ],
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Entrate Storiche");

    const headerRow = sheet.addRow([
      "intestatarioIds",
      "tipoEntrataId",
      "Intestatari",
      "Tipo Entrata",
      "Mese",
      "Valore",
    ]);

    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8D4" } };

    sheet.getColumn(1).hidden = true;
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).hidden = true;
    sheet.getColumn(2).width = 30;
    sheet.getColumn(3).width = 30;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(5).numFmt = "MM/YYYY";
    sheet.getColumn(6).width = 14;
    sheet.getColumn(6).numFmt = "#,##0.00";

    for (const entrata of entrate) {
      const row = sheet.addRow([
        entrata.intestatario.id,
        entrata.tipoEntrata.id,
        `${entrata.intestatario.nome} ${entrata.intestatario.cognome}`,
        entrata.tipoEntrata.nome,
        new Date(entrata.anno, entrata.mese - 1, 1),
        parseFloat(entrata.valore.toString()),
      ]);
      row.getCell(5).numFmt = "MM/YYYY";
    }

    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export_entrate.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET export entrate:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
