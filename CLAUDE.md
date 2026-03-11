# CLAUDE.md — Family Wealth Tracker

App web personale per il monitoraggio del patrimonio familiare.

---

## Stack

- **Next.js 15** (App Router) — TypeScript
- **PostgreSQL** con Prisma ORM
- **Material UI (MUI)** per il frontend
- **NextAuth.js** per l'autenticazione
- **ExcelJS** per import/export Excel
- **Docker + Docker Compose**
- **Deploy su Railway** (URL pubblico HTTPS, accessibile da qualsiasi dispositivo)

---

## Git & Deploy

- Repository su GitHub (branch principale: `main`)
- Ogni push su `main` triggerà automaticamente il deploy su Railway (CI/CD)
- Messaggi di commit in **italiano**, descrittivi, es: `feat: aggiunta anagrafica intestatari`
- **NON committare mai file `.env`** — usare `.env.example` per documentare le variabili

### Branch per AI assistants
- I branch creati da Claude devono seguire il pattern: `claude/<descrizione>-<session-id>`
- Non pushare mai su `main` direttamente

---

## Convenzioni di Codice

- **Lingua UI:** italiano
- **Componenti** in `/components`
- **API routes** in `/app/api`
- Sempre usare **TypeScript** (file `.ts` e `.tsx`)
- Gestione errori con **try/catch** su tutte le API routes
- Validazione input con **Zod**

---

## Regole di Business

- **Conti cointestati:** il valore viene diviso equamente tra gli intestatari
- **Un solo saldo per posizione per mese** (upsert)
- **Soft delete** per intestatari e posizioni (campo `deletedAt`)
- **Patrimonio** calcolato sull'ultimo saldo mensile disponibile per posizione
- **Form saldi:** pre-compilare con il valore del mese precedente come default
- **Form saldi:** supportare modalità formula con prefisso `=`, inclusa la variabile `prev` per il saldo precedente

---

## Comandi Utili

```bash
npm run dev                   # avvia in locale
npx prisma migrate dev        # crea una nuova migrazione
npx prisma studio             # interfaccia visuale al DB
docker-compose up --build     # avvia tutto in Docker
```

---

## Struttura del Progetto

```
patrimonno/
├── app/                          # Next.js App Router
│   ├── (auth)/
│   │   └── login/page.tsx        # Pagina di login
│   ├── (dashboard)/              # Gruppo di route protette
│   │   ├── layout.tsx            # Layout comune del dashboard (sidebar + topbar)
│   │   ├── dashboard/page.tsx    # Pagina principale: riepilogo patrimonio
│   │   ├── intestatari/page.tsx  # Gestione anagrafica intestatari
│   │   ├── conti/page.tsx        # Gestione conti/posizioni finanziarie
│   │   ├── saldi/page.tsx        # Inserimento e visualizzazione saldi mensili
│   │   ├── tipi-conto/page.tsx   # Gestione tipologie di conto
│   │   └── admin/
│   │       └── utenti/page.tsx   # Gestione utenti (solo admin)
│   ├── api/                      # API Routes (REST)
│   │   ├── auth/[...nextauth]/route.ts   # Handlers NextAuth
│   │   ├── intestatari/
│   │   │   ├── route.ts          # GET lista, POST nuovo intestatario
│   │   │   └── [id]/route.ts     # GET, PUT, DELETE per id
│   │   ├── conti/
│   │   │   ├── route.ts          # GET lista, POST nuovo conto
│   │   │   └── [id]/route.ts     # GET, PUT, DELETE per id
│   │   ├── rapporti/             # Rapporti conto↔intestatario
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── conti/route.ts
│   │   ├── saldi/
│   │   │   ├── route.ts          # GET lista, POST/upsert saldo
│   │   │   ├── [id]/route.ts     # PUT, DELETE per id
│   │   │   └── previous/route.ts # GET saldo del mese precedente
│   │   ├── tipi-conto/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   └── admin/utenti/
│   │       ├── route.ts          # GET lista utenti, POST nuovo utente
│   │       └── [id]/route.ts     # PUT, DELETE per id
│   ├── layout.tsx                # Root layout (providers, theme)
│   ├── page.tsx                  # Root page (redirect a dashboard)
│   ├── providers.tsx             # SessionProvider e ThemeProvider MUI
│   └── theme.ts                  # Tema MUI personalizzato
│
├── components/                   # Componenti React riutilizzabili
│   ├── admin/
│   │   └── UtentiTable.tsx       # Tabella gestione utenti
│   ├── conti/
│   │   ├── ContoForm.tsx         # Form creazione/modifica conto
│   │   ├── RapportiTable.tsx     # Tabella intestatari associati al conto
│   │   └── RapportoForm.tsx      # Form associazione conto↔intestatario
│   ├── intestatari/
│   │   ├── IntestatariTable.tsx  # Tabella lista intestatari
│   │   └── IntestatarioForm.tsx  # Form creazione/modifica intestatario
│   ├── layout/
│   │   ├── DashboardLayout.tsx   # Shell del layout (sidebar + contenuto)
│   │   ├── Sidebar.tsx           # Menu di navigazione laterale
│   │   └── TopBar.tsx            # Barra superiore con titolo e logout
│   ├── saldi/
│   │   ├── SaldiTable.tsx        # Tabella saldi con filtri per mese
│   │   └── SaldoForm.tsx         # Form inserimento saldo (supporta modalità formula)
│   ├── tipi-conto/
│   │   ├── TipiContoTable.tsx    # Tabella tipi conto
│   │   └── TipoContoForm.tsx     # Form creazione/modifica tipo conto
│   └── ui/
│       ├── ConfirmDialog.tsx     # Dialog di conferma azioni distruttive
│       ├── EmptyState.tsx        # Componente stato vuoto generico
│       └── MonthYearPicker.tsx   # Selettore mese/anno per filtri saldi
│
├── lib/                          # Utility e configurazioni condivise
│   ├── auth.ts                   # Configurazione NextAuth (handler, session)
│   ├── auth.config.ts            # Opzioni NextAuth (providers, callbacks)
│   ├── prisma.ts                 # Singleton Prisma Client
│   └── validations/              # Schemi Zod per validazione input
│       ├── conto.ts
│       ├── intestatario.ts
│       ├── rapporto.ts
│       ├── saldo.ts
│       ├── tipo-conto.ts
│       └── utente.ts
│
├── prisma/
│   ├── schema.prisma             # Schema del database (modelli e relazioni)
│   ├── seed.ts                   # Script di seed dati iniziali
│   └── migrations/               # Migrazioni generate da Prisma
│
├── types/
│   └── next-auth.d.ts            # Estensione tipi TypeScript per NextAuth
│
├── middleware.ts                 # Protezione route: reindirizza a login se non autenticato
├── next.config.ts                # Configurazione Next.js
├── prisma.config.ts              # Configurazione Prisma CLI
├── docker-compose.yml            # Compose: app + PostgreSQL
├── Dockerfile                    # Build immagine Docker per l'app
├── docker-entrypoint.sh          # Entrypoint Docker: migra DB poi avvia app
├── .env.example                  # Variabili d'ambiente documentate (senza valori segreti)
└── tsconfig.json                 # Configurazione TypeScript
```

---

## Istruzioni per AI Assistants

### Prima di modificare
1. Leggere sempre i file rilevanti prima di editarli
2. Capire i pattern esistenti nel codebase prima di introdurne di nuovi
3. Verificare se un componente o utility simile esiste già

### Cosa NON fare
- Non refactorare codice che non fa parte del task
- Non aggiungere feature non richieste
- Non aggiungere commenti che riformulano ciò che il codice fa già
- Non committare `.env` o file con segreti
- Non pushare su `main` senza esplicita istruzione

### Aggiornamento struttura progetto
- **Ogni volta che si aggiunge, sposta o elimina un file o una cartella**, aggiornare la sezione "Struttura del Progetto" in questo file `CLAUDE.md` nella stessa commit

### Azioni rischiose — chiedere conferma prima
- Eliminazione di file o directory
- Reset del database o migrazioni distruttive
- Force push su qualsiasi branch
- Modifica della pipeline CI/CD
