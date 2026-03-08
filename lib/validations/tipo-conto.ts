import { z } from "zod/v4";

export const tipoContoSchema = z.object({
  nome: z.string().min(1, "Il nome del tipo conto è obbligatorio"),
});
