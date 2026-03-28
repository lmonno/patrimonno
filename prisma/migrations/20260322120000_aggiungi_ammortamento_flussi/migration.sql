-- AlterTable
ALTER TABLE "flussi_straordinari" ADD COLUMN "ammortizzare" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "flussi_straordinari" ADD COLUMN "mesiAmmortamento" INTEGER;
