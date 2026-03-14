-- AlterTable
ALTER TABLE "rapporti" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tipi_entrata" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tipi_entrata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entrate" (
    "id" TEXT NOT NULL,
    "intestatarioId" TEXT NOT NULL,
    "tipoEntrataId" TEXT NOT NULL,
    "anno" INTEGER NOT NULL,
    "mese" INTEGER NOT NULL,
    "valore" DECIMAL(15,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entrate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipi_entrata_nome_key" ON "tipi_entrata"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "entrate_intestatarioId_tipoEntrataId_anno_mese_key" ON "entrate"("intestatarioId", "tipoEntrataId", "anno", "mese");

-- AddForeignKey
ALTER TABLE "entrate" ADD CONSTRAINT "entrate_intestatarioId_fkey" FOREIGN KEY ("intestatarioId") REFERENCES "intestatari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entrate" ADD CONSTRAINT "entrate_tipoEntrataId_fkey" FOREIGN KEY ("tipoEntrataId") REFERENCES "tipi_entrata"("id") ON DELETE CASCADE ON UPDATE CASCADE;
