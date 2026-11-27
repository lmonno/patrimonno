import { z } from "zod/v4";

export const spesaRicorrenteSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  importo: z.string().min(1, "L'importo è obbligatorio"),
  periodicita: z.enum(["MENSILE", "TRIMESTRALE", "SEMESTRALE", "ANNUALE"]),
  meseScadenza: z.number().int().min(1).max(12).nullable(),
  annoScadenza: z.number().int().min(2000).max(2100).nullable(),
  note: z.string().optional(),
  pagatoriIds: z.array(z.string().min(1)).min(1, "Almeno un pagatore è richiesto"),
});
