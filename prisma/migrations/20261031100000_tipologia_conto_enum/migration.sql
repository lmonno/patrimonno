-- Crea enum tipologia conto
CREATE TYPE "TipologiaConto" AS ENUM ('LIQUIDO', 'INVESTIMENTO', 'ALTRO');

-- Aggiungi colonna tipologia con default LIQUIDO
ALTER TABLE conti ADD COLUMN tipologia "TipologiaConto" NOT NULL DEFAULT 'LIQUIDO';

-- Migra dati: liquido=true → LIQUIDO, liquido=false → ALTRO
UPDATE conti SET tipologia = CASE WHEN liquido = true THEN 'LIQUIDO'::"TipologiaConto" ELSE 'ALTRO'::"TipologiaConto" END;

-- Drop view che dipende dalla colonna liquido PRIMA di rimuoverla
DROP VIEW IF EXISTS risparmio_spese;

-- Rimuovi colonna liquido
ALTER TABLE conti DROP COLUMN liquido;
CREATE VIEW risparmio_spese AS
WITH
  mesi AS (
    SELECT DISTINCT s.anno, s.mese, r."userId"
    FROM saldi s
    JOIN conti c ON c.id = s."contoId" AND c."deletedAt" IS NULL
    JOIN rapporti r ON r.id = c."rapportoId" AND r."deletedAt" IS NULL
  ),
  num_intestatari_per_conto AS (
    SELECT ci."contoId", COUNT(*) AS num_int
    FROM conto_intestatari ci
    JOIN conti c ON c.id = ci."contoId" AND c."deletedAt" IS NULL AND c.tipologia = 'LIQUIDO'
    GROUP BY ci."contoId"
  ),
  saldo_per_int AS (
    SELECT
      m.anno,
      m.mese,
      m."userId",
      ci."intestatarioId",
      SUM(s.valore / nic.num_int) AS saldo_liquido
    FROM mesi m
    JOIN conti c ON c."deletedAt" IS NULL AND c.tipologia = 'LIQUIDO'
    JOIN rapporti r ON r.id = c."rapportoId" AND r."userId" = m."userId" AND r."deletedAt" IS NULL
    JOIN saldi s ON s."contoId" = c.id AND s.anno = m.anno AND s.mese = m.mese
    JOIN conto_intestatari ci ON ci."contoId" = c.id
    JOIN num_intestatari_per_conto nic ON nic."contoId" = c.id
    GROUP BY m.anno, m.mese, m."userId", ci."intestatarioId"
  ),
  delta_saldo AS (
    SELECT
      s1.anno,
      s1.mese,
      s1."userId",
      s1."intestatarioId",
      s1.saldo_liquido - COALESCE(s0.saldo_liquido, 0) AS delta
    FROM saldo_per_int s1
    LEFT JOIN saldo_per_int s0
      ON s0."intestatarioId" = s1."intestatarioId"
     AND s0."userId" = s1."userId"
     AND (s0.anno * 12 + s0.mese) = (s1.anno * 12 + s1.mese - 1)
  ),
  tot_intestatari AS (
    SELECT "userId", COUNT(*) AS n
    FROM intestatari
    WHERE "deletedAt" IS NULL
    GROUP BY "userId"
  ),
  flussi_per_int AS (
    SELECT anno, mese, "intestatarioId", "userId", SUM(tot_flussi) AS tot_flussi
    FROM (
      SELECT
        EXTRACT(YEAR FROM f.data)::int AS anno,
        EXTRACT(MONTH FROM f.data)::int AS mese,
        i.id AS "intestatarioId",
        f."userId",
        SUM(
          CASE
            WHEN f."intestatarioId" = i.id THEN f.importo
            WHEN f."intestatarioId" IS NULL THEN f.importo / ti.n
            ELSE 0
          END
        ) AS tot_flussi
      FROM flussi_straordinari f
      JOIN intestatari i ON i."deletedAt" IS NULL AND i."userId" = f."userId"
      JOIN tot_intestatari ti ON ti."userId" = f."userId"
      WHERE (f."intestatarioId" = i.id OR f."intestatarioId" IS NULL)
        AND (f.ammortizzare IS DISTINCT FROM true)
      GROUP BY EXTRACT(YEAR FROM f.data), EXTRACT(MONTH FROM f.data), i.id, f."userId"

      UNION ALL

      SELECT
        EXTRACT(YEAR FROM fa.data)::int AS anno,
        EXTRACT(MONTH FROM fa.data)::int AS mese,
        fa."intestatarioId",
        fa."userId",
        SUM(fa.importo) AS tot_flussi
      FROM flussi_ammortizzati fa
      GROUP BY EXTRACT(YEAR FROM fa.data), EXTRACT(MONTH FROM fa.data), fa."intestatarioId", fa."userId"
    ) sub
    GROUP BY anno, mese, "intestatarioId", "userId"
  ),
  entrate_per_int AS (
    SELECT
      e.anno,
      e.mese,
      e."intestatarioId",
      SUM(e.valore) AS tot_entrate
    FROM entrate e
    GROUP BY e.anno, e.mese, e."intestatarioId"
  )
SELECT
  ds.anno,
  ds.mese,
  ds."intestatarioId",
  ds."userId",
  CONCAT(i.nome, ' ', i.cognome) AS intestatario_nome,
  ROUND((ds.delta - COALESCE(fl.tot_flussi, 0))::numeric, 2) AS risparmio,
  ROUND((COALESCE(en.tot_entrate, 0) - (ds.delta - COALESCE(fl.tot_flussi, 0)))::numeric, 2) AS spese
FROM delta_saldo ds
JOIN intestatari i ON i.id = ds."intestatarioId" AND i."deletedAt" IS NULL
LEFT JOIN flussi_per_int fl
  ON fl.anno = ds.anno AND fl.mese = ds.mese AND fl."intestatarioId" = ds."intestatarioId" AND fl."userId" = ds."userId"
LEFT JOIN entrate_per_int en
  ON en.anno = ds.anno AND en.mese = ds.mese AND en."intestatarioId" = ds."intestatarioId"
ORDER BY ds.anno, ds.mese, i.cognome, i.nome;

-- Crea view delta_fair_value per tracciare variazioni di mercato sugli investimenti
CREATE VIEW delta_fair_value AS
WITH
  num_intestatari_per_conto AS (
    SELECT ci."contoId", COUNT(*) AS num_int
    FROM conto_intestatari ci
    JOIN conti c ON c.id = ci."contoId" AND c."deletedAt" IS NULL AND c.tipologia = 'INVESTIMENTO'
    GROUP BY ci."contoId"
  ),
  saldo_per_int AS (
    SELECT
      s.anno,
      s.mese,
      r."userId",
      ci."intestatarioId",
      SUM(s.valore / nic.num_int) AS saldo_investimenti
    FROM saldi s
    JOIN conti c ON c.id = s."contoId" AND c."deletedAt" IS NULL AND c.tipologia = 'INVESTIMENTO'
    JOIN rapporti r ON r.id = c."rapportoId" AND r."deletedAt" IS NULL
    JOIN conto_intestatari ci ON ci."contoId" = c.id
    JOIN num_intestatari_per_conto nic ON nic."contoId" = c.id
    GROUP BY s.anno, s.mese, r."userId", ci."intestatarioId"
  ),
  delta AS (
    SELECT
      s1.anno,
      s1.mese,
      s1."userId",
      s1."intestatarioId",
      s1.saldo_investimenti - COALESCE(s0.saldo_investimenti, 0) AS delta
    FROM saldo_per_int s1
    LEFT JOIN saldo_per_int s0
      ON s0."intestatarioId" = s1."intestatarioId"
     AND s0."userId" = s1."userId"
     AND (s0.anno * 12 + s0.mese) = (s1.anno * 12 + s1.mese - 1)
  )
SELECT
  d.anno,
  d.mese,
  d."intestatarioId",
  d."userId",
  CONCAT(i.nome, ' ', i.cognome) AS intestatario_nome,
  ROUND(d.delta::numeric, 2) AS delta_fair_value
FROM delta d
JOIN intestatari i ON i.id = d."intestatarioId" AND i."deletedAt" IS NULL
ORDER BY d.anno, d.mese, i.cognome, i.nome;
