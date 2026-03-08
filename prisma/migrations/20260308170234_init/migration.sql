-- CreateEnum
CREATE TYPE "Ruolo" AS ENUM ('ADMIN', 'UTENTE');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cognome" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "hashedPassword" TEXT NOT NULL,
    "ruolo" "Ruolo" NOT NULL DEFAULT 'UTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipi_conto" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tipi_conto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posizioni" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipoContoId" TEXT NOT NULL,
    "iban" TEXT,
    "banca" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "posizioni_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posizione_intestatari" (
    "id" TEXT NOT NULL,
    "posizioneId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "posizione_intestatari_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saldi" (
    "id" TEXT NOT NULL,
    "posizioneId" TEXT NOT NULL,
    "anno" INTEGER NOT NULL,
    "mese" INTEGER NOT NULL,
    "valore" DECIMAL(15,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saldi_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "tipi_conto_nome_key" ON "tipi_conto"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "posizione_intestatari_posizioneId_userId_key" ON "posizione_intestatari"("posizioneId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "saldi_posizioneId_anno_mese_key" ON "saldi"("posizioneId", "anno", "mese");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posizioni" ADD CONSTRAINT "posizioni_tipoContoId_fkey" FOREIGN KEY ("tipoContoId") REFERENCES "tipi_conto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posizione_intestatari" ADD CONSTRAINT "posizione_intestatari_posizioneId_fkey" FOREIGN KEY ("posizioneId") REFERENCES "posizioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posizione_intestatari" ADD CONSTRAINT "posizione_intestatari_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saldi" ADD CONSTRAINT "saldi_posizioneId_fkey" FOREIGN KEY ("posizioneId") REFERENCES "posizioni"("id") ON DELETE CASCADE ON UPDATE CASCADE;
