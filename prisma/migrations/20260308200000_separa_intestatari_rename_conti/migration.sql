-- AlterTable: rimuovi cognome da users
ALTER TABLE "users" DROP COLUMN "cognome";

-- CreateTable: intestatari
CREATE TABLE "intestatari" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "intestatari_pkey" PRIMARY KEY ("id")
);

-- CreateTable: conti (sostituisce posizioni)
CREATE TABLE "conti" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoContoId" TEXT NOT NULL,
    "iban" TEXT,
    "banca" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "conti_pkey" PRIMARY KEY ("id")
);

-- CreateTable: conto_intestatari (sostituisce posizione_intestatari)
CREATE TABLE "conto_intestatari" (
    "id" TEXT NOT NULL,
    "contoId" TEXT NOT NULL,
    "intestatarioId" TEXT NOT NULL,

    CONSTRAINT "conto_intestatari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conto_intestatari_contoId_intestatarioId_key" ON "conto_intestatari"("contoId", "intestatarioId");

-- DropIndex (vecchi)
DROP INDEX IF EXISTS "saldi_posizioneId_anno_mese_key";

-- AlterTable saldi: rinomina colonna posizioneId -> contoId
ALTER TABLE "saldi" RENAME COLUMN "posizioneId" TO "contoId";

-- CreateIndex (nuovo unique su saldi)
CREATE UNIQUE INDEX "saldi_contoId_anno_mese_key" ON "saldi"("contoId", "anno", "mese");

-- DropForeignKey (vecchie)
ALTER TABLE "posizione_intestatari" DROP CONSTRAINT IF EXISTS "posizione_intestatari_posizioneId_fkey";
ALTER TABLE "posizione_intestatari" DROP CONSTRAINT IF EXISTS "posizione_intestatari_userId_fkey";
ALTER TABLE "posizioni" DROP CONSTRAINT IF EXISTS "posizioni_tipoContoId_fkey";
ALTER TABLE "saldi" DROP CONSTRAINT IF EXISTS "saldi_posizioneId_fkey";

-- DropTable (vecchie)
DROP TABLE IF EXISTS "posizione_intestatari";
DROP TABLE IF EXISTS "posizioni";

-- AddForeignKey
ALTER TABLE "conti" ADD CONSTRAINT "conti_tipoContoId_fkey" FOREIGN KEY ("tipoContoId") REFERENCES "tipi_conto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conto_intestatari" ADD CONSTRAINT "conto_intestatari_contoId_fkey" FOREIGN KEY ("contoId") REFERENCES "conti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conto_intestatari" ADD CONSTRAINT "conto_intestatari_intestatarioId_fkey" FOREIGN KEY ("intestatarioId") REFERENCES "intestatari"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldi" ADD CONSTRAINT "saldi_contoId_fkey" FOREIGN KEY ("contoId") REFERENCES "conti"("id") ON DELETE CASCADE ON UPDATE CASCADE;
