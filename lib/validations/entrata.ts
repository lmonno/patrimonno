import { z } from "zod/v4";

export const upsertEntrataSchema = z.object({
  intestatarioId: z.string().min(1, "Intestatario obbligatorio"),
  tipoEntrataId: z.string().min(1, "Tipo entrata obbligatorio"),
  anno: z.number().int().min(2000).max(2100),
  mese: z.number().int().min(1).max(12),
  valore: z.string().min(1, "Il valore è obbligatorio"),
  note: z.string().optional(),
});

export const bulkUpsertEntrataSchema = z.object({
  entrate: z.array(upsertEntrataSchema).min(1, "Almeno un'entrata è richiesta"),
});
