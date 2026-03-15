-- CreateTable
CREATE TABLE "categorie_flusso" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "categorie_flusso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flussi_straordinari" (
    "id" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "importo" DECIMAL(15,2) NOT NULL,
    "descrizione" TEXT NOT NULL,
    "categoriaId" TEXT NOT NULL,
    "intestatarioId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flussi_straordinari_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorie_flusso_nome_key" ON "categorie_flusso"("nome");

-- AddForeignKey
ALTER TABLE "flussi_straordinari" ADD CONSTRAINT "flussi_straordinari_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorie_flusso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flussi_straordinari" ADD CONSTRAINT "flussi_straordinari_intestatarioId_fkey" FOREIGN KEY ("intestatarioId") REFERENCES "intestatari"("id") ON DELETE SET NULL ON UPDATE CASCADE;
