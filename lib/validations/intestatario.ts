import { z } from "zod/v4";

export const createIntestatarioSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
});

export const updateIntestatarioSchema = z.object({
  nome: z.string().min(1).optional(),
  cognome: z.string().min(1).optional(),
});
