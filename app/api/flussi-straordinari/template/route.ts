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

    const [intestatari, categorie] = await Promise.all([
      prisma.intestatario.findMany({
        where: { deletedAt: null },
        orderBy: [{ cognome: "asc" }, { nome: "asc" }],
      }),
      prisma.categoriaFlusso.findMany({
        where: { deletedAt: null },
        orderBy: { nome: "asc" },
      }),
    ]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Flussi Straordinari");

    // Header
    sheet.addRow(["Data", "Importo", "Descrizione", "Categoria", "Pagante"]);
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD5E8D4" } };

    sheet.getColumn(1).width = 14;
    sheet.getColumn(1).numFmt = "DD/MM/YYYY";
    sheet.getColumn(2).width = 14;
    sheet.getColumn(2).numFmt = "#,##0.00";
    sheet.getColumn(3).width = 40;
    sheet.getColumn(4).width = 20;
    sheet.getColumn(5).width = 25;

    // Foglio di riferimento con categorie e intestatari validi
    const refSheet = workbook.addWorksheet("Riferimenti");
    refSheet.addRow(["Categorie disponibili", "Paganti disponibili"]);
    refSheet.getRow(1).font = { bold: true };

    const maxRows = Math.max(categorie.length, intestatari.length + 1);
    for (let i = 0; i < maxRows; i++) {
      const catNome = i < categorie.length ? categorie[i].nome : "";
      let pagante = "";
      if (i === 0) {
        pagante = "Comune";
      } else if (i - 1 < intestatari.length) {
        pagante = `${intestatari[i - 1].nome} ${intestatari[i - 1].cognome}`;
      }
      refSheet.addRow([catNome, pagante]);
    }

    refSheet.getColumn(1).width = 25;
    refSheet.getColumn(2).width = 30;

    // Validazione dropdown per Categoria (colonna 4)
    const catList = categorie.map((c) => c.nome);
    if (catList.length > 0) {
      for (let row = 2; row <= 500; row++) {
        sheet.getCell(row, 4).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [`"${catList.join(",")}"`],
        };
      }
    }

    // Validazione dropdown per Pagante (colonna 5)
    const paganteList = ["Comune", ...intestatari.map((i) => `${i.nome} ${i.cognome}`)];
    for (let row = 2; row <= 500; row++) {
      sheet.getCell(row, 5).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [`"${paganteList.join(",")}"`],
      };
    }

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_flussi_straordinari.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET template flussi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
