-- Aggiunge userId a intestatari, rapporti, flussi_straordinari
-- con duplicazione dati per utenti multipli

ALTER TABLE "intestatari" ADD COLUMN "userId" TEXT;
ALTER TABLE "rapporti" ADD COLUMN "userId" TEXT;
ALTER TABLE "flussi_straordinari" ADD COLUMN "userId" TEXT;

-- Popola userId e duplica i dati per ogni utente registrato
DO $$
DECLARE
  v_first_user_id TEXT;
  v_user_id TEXT;
BEGIN
  SELECT id INTO v_first_user_id
  FROM users
  WHERE "deletedAt" IS NULL
  ORDER BY "createdAt"
  LIMIT 1;

  IF v_first_user_id IS NULL THEN RETURN; END IF;

  -- Assegna tutti i record esistenti al primo utente
  UPDATE intestatari SET "userId" = v_first_user_id WHERE "userId" IS NULL;
  UPDATE rapporti SET "userId" = v_first_user_id WHERE "userId" IS NULL;
  UPDATE flussi_straordinari SET "userId" = v_first_user_id WHERE "userId" IS NULL;

  -- Per ogni utente aggiuntivo, duplica tutti i dati
  FOR v_user_id IN
    SELECT id FROM users
    WHERE "deletedAt" IS NULL AND id != v_first_user_id
    ORDER BY "createdAt"
  LOOP
    CREATE TEMP TABLE _int_map (old_id TEXT, new_id TEXT);
    CREATE TEMP TABLE _rap_map (old_id TEXT, new_id TEXT);
    CREATE TEMP TABLE _conto_map (old_id TEXT, new_id TEXT);

    -- Genera IDs per intestatari
    INSERT INTO _int_map (old_id, new_id)
    SELECT id, gen_random_uuid()::text FROM intestatari WHERE "userId" = v_first_user_id;

    INSERT INTO intestatari (id, nome, cognome, "userId", "createdAt", "updatedAt", "deletedAt")
    SELECT m.new_id, i.nome, i.cognome, v_user_id, i."createdAt", i."updatedAt", i."deletedAt"
    FROM intestatari i JOIN _int_map m ON m.old_id = i.id;

    -- Genera IDs per rapporti
    INSERT INTO _rap_map (old_id, new_id)
    SELECT id, gen_random_uuid()::text FROM rapporti WHERE "userId" = v_first_user_id;

    INSERT INTO rapporti (id, nome, istituto, iban, note, archiviato, "userId", "createdAt", "updatedAt", "deletedAt")
    SELECT m.new_id, r.nome, r.istituto, r.iban, r.note, r.archiviato, v_user_id, r."createdAt", r."updatedAt", r."deletedAt"
    FROM rapporti r JOIN _rap_map m ON m.old_id = r.id;

    -- Genera IDs per conti
    INSERT INTO _conto_map (old_id, new_id)
    SELECT c.id, gen_random_uuid()::text
    FROM conti c JOIN _rap_map rm ON rm.old_id = c."rapportoId";

    INSERT INTO conti (id, "rapportoId", nome, "tipoContoId", liquido, archiviato, ordine, note, "createdAt", "updatedAt", "deletedAt")
    SELECT cm.new_id, rm.new_id, c.nome, c."tipoContoId", c.liquido, c.archiviato, c.ordine, c.note, c."createdAt", c."updatedAt", c."deletedAt"
    FROM conti c
    JOIN _rap_map rm ON rm.old_id = c."rapportoId"
    JOIN _conto_map cm ON cm.old_id = c.id;

    -- Conto intestatari
    INSERT INTO conto_intestatari (id, "contoId", "intestatarioId")
    SELECT gen_random_uuid()::text, cm.new_id, im.new_id
    FROM conto_intestatari ci
    JOIN _conto_map cm ON cm.old_id = ci."contoId"
    JOIN _int_map im ON im.old_id = ci."intestatarioId";

    -- Saldi
    INSERT INTO saldi (id, "contoId", anno, mese, valore, formula, "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, cm.new_id, s.anno, s.mese, s.valore, s.formula, s."createdAt", s."updatedAt"
    FROM saldi s JOIN _conto_map cm ON cm.old_id = s."contoId";

    -- Entrate
    INSERT INTO entrate (id, "intestatarioId", "tipoEntrataId", anno, mese, valore, note, "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, im.new_id, e."tipoEntrataId", e.anno, e.mese, e.valore, e.note, e."createdAt", e."updatedAt"
    FROM entrate e JOIN _int_map im ON im.old_id = e."intestatarioId";

    -- Flussi straordinari con intestatario
    INSERT INTO flussi_straordinari (id, data, importo, descrizione, "categoriaId", "intestatarioId", ammortizzare, "mesiAmmortamento", "userId", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, f.data, f.importo, f.descrizione, f."categoriaId", im.new_id, f.ammortizzare, f."mesiAmmortamento", v_user_id, f."createdAt", f."updatedAt"
    FROM flussi_straordinari f
    JOIN _int_map im ON im.old_id = f."intestatarioId"
    WHERE f."userId" = v_first_user_id AND f."intestatarioId" IS NOT NULL;

    -- Flussi straordinari comuni (senza intestatario)
    INSERT INTO flussi_straordinari (id, data, importo, descrizione, "categoriaId", "intestatarioId", ammortizzare, "mesiAmmortamento", "userId", "createdAt", "updatedAt")
    SELECT gen_random_uuid()::text, f.data, f.importo, f.descrizione, f."categoriaId", NULL, f.ammortizzare, f."mesiAmmortamento", v_user_id, f."createdAt", f."updatedAt"
    FROM flussi_straordinari f
    WHERE f."userId" = v_first_user_id AND f."intestatarioId" IS NULL;

    DROP TABLE _int_map, _rap_map, _conto_map;
  END LOOP;
END $$;

-- Rende le colonne NOT NULL
ALTER TABLE "intestatari" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "rapporti" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "flussi_straordinari" ALTER COLUMN "userId" SET NOT NULL;

-- Foreign key constraints
ALTER TABLE "intestatari" ADD CONSTRAINT "intestatari_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "rapporti" ADD CONSTRAINT "rapporti_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "flussi_straordinari" ADD CONSTRAINT "flussi_straordinari_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Aggiorna la vista risparmio_spese per includere userId e supportare multi-tenancy
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
    GROUP BY EXTRACT(YEAR FROM f.data), EXTRACT(MONTH FROM f.data), i.id, f."userId"
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
