-- Crea tabella rapporti
CREATE TABLE "rapporti" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "istituto" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rapporti_pkey" PRIMARY KEY ("id")
);

-- Aggiunge colonna rapportoId a conti (nullable per la data migration)
ALTER TABLE "conti" ADD COLUMN "rapportoId" TEXT;

-- Data migration: crea un rapporto per ogni conto esistente (usando l'id del conto)
INSERT INTO "rapporti" ("id", "nome", "istituto", "updatedAt")
SELECT id, nome, banca, NOW()
FROM "conti";

-- Imposta rapportoId = id del conto (ogni conto ottiene il proprio rapporto)
UPDATE "conti" SET "rapportoId" = id;

-- Rende rapportoId NOT NULL
ALTER TABLE "conti" ALTER COLUMN "rapportoId" SET NOT NULL;

-- Aggiunge foreign key constraint
ALTER TABLE "conti" ADD CONSTRAINT "conti_rapportoId_fkey"
    FOREIGN KEY ("rapportoId") REFERENCES "rapporti"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- Rimuove la colonna banca (ora è su rapporti.istituto)
ALTER TABLE "conti" DROP COLUMN "banca";
