import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import ExcelJS from "exceljs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Piano Ammortamento");

    const headers = ["Data", "Quota Capitale", "Quota Interessi", "Rata Totale", "Debito Residuo", "Contributo"];
    sheet.addRow(headers);

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFBDD7EE" } };

    sheet.getColumn(1).width = 14;
    sheet.getColumn(1).numFmt = "DD/MM/YYYY";
    for (let i = 2; i <= 6; i++) {
      sheet.getColumn(i).width = 18;
      sheet.getColumn(i).numFmt = "#,##0.00";
    }

    sheet.views = [{ state: "frozen", ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_piano_ammortamento.xlsx"`,
      },
    });
  } catch (error) {
    console.error("Errore GET template piano ammortamento:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
