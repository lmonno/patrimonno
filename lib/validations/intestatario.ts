import { z } from "zod/v4";

export const createIntestatarioSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  cognome: z.string().min(1, "Il cognome è obbligatorio"),
  email: z.email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  ruolo: z.enum(["ADMIN", "UTENTE"]).default("UTENTE"),
});

export const updateIntestatarioSchema = z.object({
  nome: z.string().min(1).optional(),
  cognome: z.string().min(1).optional(),
  email: z.email().optional(),
  password: z.string().min(8).optional(),
  ruolo: z.enum(["ADMIN", "UTENTE"]).optional(),
});
