-- CreateView: risparmio_spese
CREATE OR REPLACE VIEW risparmio_spese AS
WITH
  -- Tutti i mesi con saldi esistenti
  mesi AS (
    SELECT DISTINCT anno, mese FROM saldi
  ),
  -- Numero intestatari per conto (solo conti liquidi attivi)
  num_intestatari_per_conto AS (
    SELECT ci."contoId", COUNT(*) AS num_int
    FROM conto_intestatari ci
    JOIN conti c ON c.id = ci."contoId" AND c."deletedAt" IS NULL AND c.liquido = true
    GROUP BY ci."contoId"
  ),
  -- Saldo liquido per intestatario per mese (quota proporzionale per conti cointestati)
  saldo_per_int AS (
    SELECT
      m.anno,
      m.mese,
      ci."intestatarioId",
      SUM(s.valore / nic.num_int) AS saldo_liquido
    FROM mesi m
    JOIN saldi s ON s.anno = m.anno AND s.mese = m.mese
    JOIN conti c ON c.id = s."contoId" AND c."deletedAt" IS NULL AND c.liquido = true
    JOIN conto_intestatari ci ON ci."contoId" = c.id
    JOIN num_intestatari_per_conto nic ON nic."contoId" = c.id
    GROUP BY m.anno, m.mese, ci."intestatarioId"
  ),
  -- Delta saldo: saldo corrente - saldo mese precedente
  delta_saldo AS (
    SELECT
      s1.anno,
      s1.mese,
      s1."intestatarioId",
      s1.saldo_liquido - COALESCE(s0.saldo_liquido, 0) AS delta
    FROM saldo_per_int s1
    LEFT JOIN saldo_per_int s0
      ON s0."intestatarioId" = s1."intestatarioId"
     AND (s0.anno * 12 + s0.mese) = (s1.anno * 12 + s1.mese - 1)
  ),
  -- Numero totale di intestatari attivi (per distribuzione flussi comuni)
  tot_intestatari AS (
    SELECT COUNT(*) AS n FROM intestatari WHERE "deletedAt" IS NULL
  ),
  -- Flussi straordinari per mese per intestatario
  flussi_per_int AS (
    SELECT
      EXTRACT(YEAR FROM f.data)::int AS anno,
      EXTRACT(MONTH FROM f.data)::int AS mese,
      i.id AS "intestatarioId",
      SUM(
        CASE
          WHEN f."intestatarioId" = i.id THEN f.importo
          WHEN f."intestatarioId" IS NULL THEN f.importo / ti.n
          ELSE 0
        END
      ) AS tot_flussi
    FROM flussi_straordinari f
    CROSS JOIN intestatari i
    CROSS JOIN tot_intestatari ti
    WHERE i."deletedAt" IS NULL
      AND (f."intestatarioId" = i.id OR f."intestatarioId" IS NULL)
    GROUP BY EXTRACT(YEAR FROM f.data), EXTRACT(MONTH FROM f.data), i.id
  ),
  -- Entrate totali per mese per intestatario
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
  CONCAT(i.nome, ' ', i.cognome) AS intestatario_nome,
  ROUND((ds.delta - COALESCE(fl.tot_flussi, 0))::numeric, 2) AS risparmio,
  ROUND((COALESCE(en.tot_entrate, 0) - (ds.delta - COALESCE(fl.tot_flussi, 0)))::numeric, 2) AS spese
FROM delta_saldo ds
JOIN intestatari i ON i.id = ds."intestatarioId" AND i."deletedAt" IS NULL
LEFT JOIN flussi_per_int fl
  ON fl.anno = ds.anno AND fl.mese = ds.mese AND fl."intestatarioId" = ds."intestatarioId"
LEFT JOIN entrate_per_int en
  ON en.anno = ds.anno AND en.mese = ds.mese AND en."intestatarioId" = ds."intestatarioId"
ORDER BY ds.anno, ds.mese, i.cognome, i.nome;
