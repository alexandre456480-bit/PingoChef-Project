import { z } from 'zod';

export const productFlavorsSchema = z.array(z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).regex(/^[^<>\x00-\x1f\x7f]+$/, 'Nome de sabor inválido'),
  price: z.number().finite().positive().max(999999.99).nullable(),
  isAvailable: z.boolean()
}).strict()).max(30).superRefine((rows, ctx) => {
  if (new Set(rows.map(row => row.id)).size !== rows.length || new Set(rows.map(row => row.name.toLocaleLowerCase('pt-BR'))).size !== rows.length)
    ctx.addIssue({ code: 'custom', message: 'Os sabores devem ter nomes e identificadores únicos.' });
});
export type ProductFlavor = z.infer<typeof productFlavorsSchema>[number];
