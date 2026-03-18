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
      where: { deletedAt: null, archiviato: false, rapporto: { archiviato: false } },
      include: {
        rapporto: { select: { nome: true, istituto: true } },
        tipoConto: { select: { nome: true } },
        intestatari: {
          include: {
            intestatario: { select: { nome: true, cognome: true } },
          },
        },
      },
      orderBy: [{ ordine: "asc" }, { rapporto: { nome: "asc" } }, { nome: "asc" }],
    });

    const saldi = await prisma.saldo.findMany({
      select: { contoId: true, anno: true, mese: true, valore: true },
      orderBy: [{ anno: "asc" }, { mese: "asc" }],
    });

    // Costruisci mappa contoId -> { "anno-mese" -> valore }
    const saldiMap = new Map<string, Map<string, number>>();
    const monthsSet = new Set<string>();

    for (const s of saldi) {
      const key = `${s.anno}-${s.mese}`;
      monthsSet.add(key);
      if (!saldiMap.has(s.contoId)) saldiMap.set(s.contoId, new Map());
      saldiMap.get(s.contoId)!.set(key, parseFloat(s.valore.toString()));
    }

    // Ordina i mesi cronologicamente
    const months = [...monthsSet].sort((a, b) => {
      const [aY, aM] = a.split("-").map(Number);
      const [bY, bM] = b.split("-").map(Number);
      return aY !== bY ? aY - bY : aM - bM;
    });

    const monthLabels = months.map((m) => {
      const [anno, mese] = m.split("-");
      return `${mese.padStart(2, "0")}/${anno}`;
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Saldi Storici");

    const fixedHeaders = ["contoId", "Rapporto", "Istituto", "Conto", "Tipo", "Intestatari"];
    sheet.addRow([...fixedHeaders, ...monthLabels]);

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
    for (let i = 7; i <= 6 + months.length; i++) {
      sheet.getColumn(i).width = 12;
      sheet.getColumn(i).numFmt = "#,##0.00";
    }

    for (const conto of conti) {
      const intestatariStr = conto.intestatari
        .map((i: { intestatario: { nome: string; cognome: string } }) => `${i.intestatario.nome} ${i.intestatario.cognome}`)
        .join(", ");

      const contoSaldi = saldiMap.get(conto.id);
      const valori = months.map((m) => contoSaldi?.get(m) ?? null);

      sheet.addRow([
        conto.id,
        conto.rapporto.nome,
        conto.rapporto.istituto,
        conto.nome,
        conto.tipoConto.nome,
        intestatariStr,
        ...valori,
      ]);
    }

    sheet.views = [{ state: "frozen", xSplit: 6, ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="export_saldi.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET export saldi:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
