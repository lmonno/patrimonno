-- AlterTable: aggiungi iban a rapporti
ALTER TABLE "rapporti" ADD COLUMN "iban" TEXT;

-- Migra dati: copia l'IBAN dal primo conto (non eliminato) di ogni rapporto
UPDATE "rapporti" r
SET "iban" = (
  SELECT c."iban"
  FROM "conti" c
  WHERE c."rapportoId" = r."id"
    AND c."iban" IS NOT NULL
    AND c."deletedAt" IS NULL
  ORDER BY c."createdAt" ASC
  LIMIT 1
);

-- AlterTable: rimuovi iban da conti
ALTER TABLE "conti" DROP COLUMN "iban";
