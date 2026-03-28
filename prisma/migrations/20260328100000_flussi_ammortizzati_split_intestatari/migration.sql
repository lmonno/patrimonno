-- Aggiorna flussi_ammortizzati: divide per intestatari oltre che per mesi
-- Se intestatarioId è impostato → importo / mesiAmmortamento (riga singola)
-- Se intestatarioId è NULL → importo / mesiAmmortamento / num_intestatari (una riga per intestatario)

CREATE OR REPLACE VIEW flussi_ammortizzati AS
WITH tot_intestatari AS (
  SELECT "userId", COUNT(*) AS n
  FROM intestatari
  WHERE "deletedAt" IS NULL
  GROUP BY "userId"
)
-- Flussi con intestatario specifico: una riga per mese
SELECT
  f.id                                                                              AS flusso_id,
  f.id || '_' || gs.mese                                                           AS id,
  (DATE_TRUNC('month', f.data) + ((gs.mese - 1) * INTERVAL '1 month'))::date      AS data,
  ROUND(f.importo / f."mesiAmmortamento", 2)                                       AS importo,
  f.descrizione,
  f."categoriaId",
  f."intestatarioId",
  f."userId",
  gs.mese                                                                           AS mese_numero,
  f."mesiAmmortamento"                                                              AS totale_mesi
FROM flussi_straordinari f
CROSS JOIN LATERAL generate_series(1, f."mesiAmmortamento") AS gs(mese)
WHERE f.ammortizzare = true
  AND f."mesiAmmortamento" IS NOT NULL
  AND f."mesiAmmortamento" > 0
  AND f."intestatarioId" IS NOT NULL

UNION ALL

-- Flussi condivisi (intestatarioId NULL): una riga per mese per intestatario
SELECT
  f.id                                                                              AS flusso_id,
  f.id || '_' || gs.mese || '_' || i.id                                            AS id,
  (DATE_TRUNC('month', f.data) + ((gs.mese - 1) * INTERVAL '1 month'))::date      AS data,
  ROUND(f.importo / f."mesiAmmortamento" / ti.n, 2)                                AS importo,
  f.descrizione,
  f."categoriaId",
  i.id                                                                              AS "intestatarioId",
  f."userId",
  gs.mese                                                                           AS mese_numero,
  f."mesiAmmortamento"                                                              AS totale_mesi
FROM flussi_straordinari f
CROSS JOIN LATERAL generate_series(1, f."mesiAmmortamento") AS gs(mese)
JOIN intestatari i ON i."userId" = f."userId" AND i."deletedAt" IS NULL
JOIN tot_intestatari ti ON ti."userId" = f."userId"
WHERE f.ammortizzare = true
  AND f."mesiAmmortamento" IS NOT NULL
  AND f."mesiAmmortamento" > 0
  AND f."intestatarioId" IS NULL;

-- Aggiorna risparmio_spese: semplifica la sezione flussi ammortizzati
-- dato che flussi_ammortizzati ora gestisce già lo split per intestatario
DROP VIEW IF EXISTS risparmio_spese;
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
    JOIN conti c ON c.id = ci."contoId" AND c."deletedAt" IS NULL AND c.liquido = true
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
    JOIN conti c ON c."deletedAt" IS NULL AND c.liquido = true
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
      -- Flussi straordinari non ammortizzati
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

      -- Quote mensili da flussi ammortizzati (già divise per intestatario nella vista)
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
