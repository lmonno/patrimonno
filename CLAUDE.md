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
- **Mobile-first:** tutte le pagine e i form devono essere ottimizzati per cellulare (card layout su mobile, tabella su desktop; dialog fullScreen su mobile; usare `useMediaQuery` con breakpoint `md`)

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

### Azioni rischiose — chiedere conferma prima
- Eliminazione di file o directory
- Reset del database o migrazioni distruttive
- Force push su qualsiasi branch
- Modifica della pipeline CI/CD
