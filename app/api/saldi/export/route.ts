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
    const mese = parseInt(searchParams.get("mese") ?? (new Date().getMonth() + 1).toString());

    const saldi = await prisma.saldo.findMany({
      where: { anno, mese },
      include: {
        conto: {
          select: {
            id: true,
            nome: true,
            rapporto: { select: { nome: true, istituto: true } },
            tipoConto: { select: { nome: true } },
            intestatari: {
              include: {
                intestatario: { select: { nome: true, cognome: true } },
              },
            },
          },
        },
      },
      orderBy: [{ conto: { ordine: "asc" } }, { conto: { rapporto: { nome: "asc" } } }, { conto: { nome: "asc" } }],
    });

    const meseLabel = `${String(mese).padStart(2, "0")}/${anno}`;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Saldi Storici");

    const fixedHeaders = ["contoId", "Rapporto", "Istituto", "Conto", "Tipo", "Intestatari"];
    sheet.addRow([...fixedHeaders, meseLabel]);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };

    sheet.getColumn(1).hidden = true;
    sheet.getColumn(1).width = 30;
    sheet.getColumn(2).width = 20;
    sheet.getColumn(3).width = 20;
    sheet.getColumn(4).width = 25;
    sheet.getColumn(5).width = 15;
    sheet.getColumn(6).width = 30;
    sheet.getColumn(7).width = 12;
    sheet.getColumn(7).numFmt = "#,##0.00";

    for (const saldo of saldi) {
      const intestatariStr = saldo.conto.intestatari
        .map((i: { intestatario: { nome: string; cognome: string } }) => `${i.intestatario.nome} ${i.intestatario.cognome}`)
        .join(", ");

      sheet.addRow([
        saldo.conto.id,
        saldo.conto.rapporto.nome,
        saldo.conto.rapporto.istituto,
        saldo.conto.nome,
        saldo.conto.tipoConto.nome,
        intestatariStr,
        parseFloat(saldo.valore.toString()),
      ]);
    }

    sheet.views = [{ state: "frozen", xSplit: 6, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="saldi_${anno}_${String(mese).padStart(2, "0")}.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET export saldi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
