-- CreateTable
CREATE TABLE "piani_ammortamento" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "contoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "piani_ammortamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_ammortamento" (
    "id" TEXT NOT NULL,
    "pianoAmmortamentoId" TEXT NOT NULL,
    "data" DATE NOT NULL,
    "quotaCapitale" DECIMAL(15,2) NOT NULL,
    "quotaInteressi" DECIMAL(15,2) NOT NULL,
    "rataTotale" DECIMAL(15,2) NOT NULL,
    "debitoResiduo" DECIMAL(15,2) NOT NULL,
    "contributo" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_ammortamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rate_ammortamento_pianoAmmortamentoId_data_key" ON "rate_ammortamento"("pianoAmmortamentoId", "data");

-- AddForeignKey
ALTER TABLE "piani_ammortamento" ADD CONSTRAINT "piani_ammortamento_contoId_fkey" FOREIGN KEY ("contoId") REFERENCES "conti"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "piani_ammortamento" ADD CONSTRAINT "piani_ammortamento_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_ammortamento" ADD CONSTRAINT "rate_ammortamento_pianoAmmortamentoId_fkey" FOREIGN KEY ("pianoAmmortamentoId") REFERENCES "piani_ammortamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
