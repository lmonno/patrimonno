import { z } from "zod/v4";

export const createRapportoSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  istituto: z.string().min(1, "L'istituto è obbligatorio"),
  note: z.string().optional().nullable(),
});

export const updateRapportoSchema = z.object({
  nome: z.string().min(1).optional(),
  istituto: z.string().min(1).optional(),
  note: z.string().optional().nullable(),
});
