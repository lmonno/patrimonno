import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
    }

    const { id } = await params;
    await prisma.entrata.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Errore DELETE entrata:", error);
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 });
  }
}
