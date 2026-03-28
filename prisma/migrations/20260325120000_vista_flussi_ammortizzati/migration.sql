-- CreateView: flussi_ammortizzati
-- Espande i flussi straordinari con ammortizzare=true in N righe mensili
CREATE OR REPLACE VIEW flussi_ammortizzati AS
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
  AND f."mesiAmmortamento" > 0;
