-- CreateEnum
CREATE TYPE "Periodicita" AS ENUM ('MENSILE', 'TRIMESTRALE', 'SEMESTRALE', 'ANNUALE');

-- CreateTable
CREATE TABLE "spese_ricorrenti" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "importo" DECIMAL(15,2) NOT NULL,
    "periodicita" "Periodicita" NOT NULL,
    "meseScadenza" INTEGER,
    "annoScadenza" INTEGER,
    "note" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "spese_ricorrenti_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spesa_pagatori" (
    "id" TEXT NOT NULL,
    "spesaRicorrenteId" TEXT NOT NULL,
    "intestatarioId" TEXT NOT NULL,

    CONSTRAINT "spesa_pagatori_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spesa_pagatori_spesaRicorrenteId_intestatarioId_key" ON "spesa_pagatori"("spesaRicorrenteId", "intestatarioId");

-- AddForeignKey
ALTER TABLE "spese_ricorrenti" ADD CONSTRAINT "spese_ricorrenti_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spesa_pagatori" ADD CONSTRAINT "spesa_pagatori_spesaRicorrenteId_fkey" FOREIGN KEY ("spesaRicorrenteId") REFERENCES "spese_ricorrenti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spesa_pagatori" ADD CONSTRAINT "spesa_pagatori_intestatarioId_fkey" FOREIGN KEY ("intestatarioId") REFERENCES "intestatari"("id") ON DELETE CASCADE ON UPDATE CASCADE;
