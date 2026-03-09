import { PrismaClient, Ruolo } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const tipiConto = [
    "Conto Corrente",
    "Conto Titoli",
    "Conto Deposito",
    "Investimento",
    "Assicurazione",
    "Fondo Pensione",
    "Altro",
  ];

  for (const nome of tipiConto) {
    await prisma.tipoConto.upsert({
      where: { nome },
      update: {},
      create: { nome },
    });
  }

  const hashedPassword = await bcrypt.hash("admin123!", 12);

  await prisma.user.upsert({
    where: { email: "admin@family.local" },
    update: {},
    create: {
      nome: "Admin",
      email: "admin@family.local",
      hashedPassword,
      ruolo: Ruolo.ADMIN,
    },
  });

  console.log("Seed completato con successo!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
