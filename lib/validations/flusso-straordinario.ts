import { z } from "zod/v4";

export const createFlussoSchema = z.object({
  data: z.string().min(1, "Data obbligatoria"),
  importo: z.string().min(1, "Importo obbligatorio"),
  descrizione: z.string().min(1, "Descrizione obbligatoria"),
  categoriaId: z.string().min(1, "Categoria obbligatoria"),
  intestatarioId: z.string().nullable(),
});

export const updateFlussoSchema = z.object({
  data: z.string().min(1, "Data obbligatoria").optional(),
  importo: z.string().min(1, "Importo obbligatorio").optional(),
  descrizione: z.string().min(1, "Descrizione obbligatoria").optional(),
  categoriaId: z.string().min(1, "Categoria obbligatoria").optional(),
  intestatarioId: z.string().nullable().optional(),
});
