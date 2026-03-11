import { z } from "zod/v4";

export const createUtenteSchema = z.object({
  nome: z.string().min(1, "Il nome è obbligatorio"),
  email: z.email("Email non valida"),
  password: z.string().min(8, "La password deve essere di almeno 8 caratteri"),
  ruolo: z.enum(["ADMIN", "UTENTE"]).default("UTENTE"),
});

export const updateUtenteSchema = z.object({
  ruolo: z.enum(["ADMIN", "UTENTE"]),
});
