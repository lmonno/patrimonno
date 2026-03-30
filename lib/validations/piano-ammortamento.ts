import { z } from "zod/v4";

export const rataAmmortamentoSchema = z.object({
  data: z.string().min(1, "Data obbligatoria"),
  quotaCapitale: z.string().min(1, "Quota capitale obbligatoria"),
  quotaInteressi: z.string().min(1, "Quota interessi obbligatoria"),
  rataTotale: z.string().min(1, "Rata totale obbligatoria"),
  debitoResiduo: z.string().min(1, "Debito residuo obbligatorio"),
  contributo: z.string().optional(),
});

export const createPianoSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio"),
  contoId: z.string().min(1, "Conto obbligatorio"),
  rate: z.array(rataAmmortamentoSchema).min(1, "Almeno una rata è richiesta"),
});

export const updatePianoSchema = z.object({
  nome: z.string().min(1, "Nome obbligatorio").optional(),
  contoId: z.string().min(1, "Conto obbligatorio").optional(),
  rate: z.array(rataAmmortamentoSchema).min(1, "Almeno una rata è richiesta").optional(),
});
