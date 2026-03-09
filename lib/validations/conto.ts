import { z } from "zod/v4";

export const createContoSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  tipoContoId: z.string().min(1, "Tipo conto non valido"),
  iban: z.string().optional().nullable(),
  banca: z.string().min(1, "La banca/istituto è obbligatoria"),
  note: z.string().optional().nullable(),
  intestatariIds: z.array(z.string().min(1)).min(1, "Almeno un intestatario è richiesto"),
});

export const updateContoSchema = z.object({
  nome: z.string().min(1).optional(),
  tipoContoId: z.string().min(1).optional(),
  iban: z.string().optional().nullable(),
  banca: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
  intestatariIds: z.array(z.string().min(1)).min(1).optional(),
});
