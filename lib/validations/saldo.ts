import { z } from "zod/v4";

export const upsertSaldoSchema = z.object({
  contoId: z.string().min(1, "Conto obbligatorio"),
  anno: z.number().int().min(2000).max(2100),
  mese: z.number().int().min(1).max(12),
  valore: z.string().min(1, "Il valore è obbligatorio"),
  formula: z.string().optional(),
});

export const bulkUpsertSaldoSchema = z.object({
  saldi: z.array(upsertSaldoSchema).min(1, "Almeno un saldo è richiesto"),
});
