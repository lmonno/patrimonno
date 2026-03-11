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

    const conti = await prisma.conto.findMany({
      where: { deletedAt: null },
      include: {
        rapporto: { select: { nome: true, istituto: true } },
        tipoConto: { select: { nome: true } },
        intestatari: {
          include: {
            intestatario: { select: { nome: true, cognome: true } },
          },
        },
      },
      orderBy: [{ rapporto: { nome: "asc" } }, { nome: "asc" }],
    });

    // Colonne mesi: da gen 2020 al mese corrente
    const months: { anno: number; mese: number; label: string }[] = [];
    const now = new Date();
    const endAnno = now.getFullYear();
    const endMese = now.getMonth() + 1;

    for (let anno = 2020; anno <= endAnno; anno++) {
      const lastMese = anno === endAnno ? endMese : 12;
      for (let mese = 1; mese <= lastMese; mese++) {
        months.push({
          anno,
          mese,
          label: `${String(mese).padStart(2, "0")}/${anno}`,
        });
      }
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Saldi Storici");

    const fixedHeaders = ["contoId", "Rapporto", "Istituto", "Conto", "Tipo", "Intestatari"];
    sheet.addRow([...fixedHeaders, ...months.map((m) => m.label)]);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };

    // Colonna contoId nascosta (usata come chiave per l'import)
    sheet.getColumn(1).hidden = true;
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 25;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 30;
    for (let i = 7; i <= 6 + months.length; i++) {
      sheet.getColumn(i).width = 12;
      sheet.getColumn(i).numFmt = '#,##0.00';
    }

    for (const conto of conti) {
      const intestatariStr = conto.intestatari
        .map((i: { intestatario: { nome: string; cognome: string } }) => `${i.intestatario.nome} ${i.intestatario.cognome}`)
        .join(", ");

      sheet.addRow([
        conto.id,
        conto.rapporto.nome,
        conto.rapporto.istituto,
        conto.nome,
        conto.tipoConto.nome,
        intestatariStr,
        ...months.map(() => null),
      ]);
    }

    // Blocca intestazione e colonne informative durante lo scroll
    sheet.views = [{ state: "frozen", xSplit: 6, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_saldi_storici.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET template saldi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
