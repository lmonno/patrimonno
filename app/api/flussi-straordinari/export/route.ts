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
    const anno = parseInt(searchParams.get("anno") ?? new Date().getFullYear().toString());

    const flussi = await prisma.flussoStraordinario.findMany({
      where: {
        data: {
          gte: new Date(`${anno}-01-01`),
          lt: new Date(`${anno + 1}-01-01`),
        },
      },
      include: {
        categoria: { select: { nome: true } },
        intestatario: { select: { nome: true, cognome: true } },
      },
      orderBy: { data: "desc" },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Flussi Straordinari");

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

    for (const flusso of flussi) {
      const pagante = flusso.intestatario
        ? `${flusso.intestatario.nome} ${flusso.intestatario.cognome}`
        : "Comune";

      sheet.addRow([
        new Date(flusso.data),
        parseFloat(flusso.importo.toString()),
        flusso.descrizione,
        flusso.categoria.nome,
        pagante,
      ]);
    }

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="flussi_straordinari_${anno}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET export flussi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
