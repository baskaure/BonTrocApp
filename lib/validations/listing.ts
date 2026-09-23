import { z } from 'zod';

// Limites serveur : listings_text_lengths (titre 3 à 120, descriptions ≤ 3000) et
// listings_estimation_order (min ≤ max).
export const createListingSchema = z
  .object({
    type: z.enum(['service', 'product']),
    title: z.string().trim().min(3, 'Le titre doit faire au moins 3 caractères').max(120, 'Le titre est trop long (120 caractères max)'),
    description_offer: z.string().trim().min(10, 'Décrivez ce que vous offrez (min. 10 caractères)').max(3000, 'Description trop longue (3000 caractères max)'),
    desired_exchange_desc: z.string().trim().min(10, 'Décrivez ce que vous cherchez (min. 10 caractères)').max(3000, 'Description trop longue (3000 caractères max)'),
    mode: z.enum(['remote', 'on_site', 'both']),
    category_id: z.string().optional(),
    estimation_min: z.string().optional(),
    estimation_max: z.string().optional(),
  })
  .refine(
    (data) => {
      const min = data.estimation_min ? parseFloat(data.estimation_min) : NaN;
      const max = data.estimation_max ? parseFloat(data.estimation_max) : NaN;
      return Number.isNaN(min) || Number.isNaN(max) || min <= max;
    },
    { message: 'L’estimation minimale doit être inférieure à la maximale', path: ['estimation_max'] },
  );

export type CreateListingFormData = z.infer<typeof createListingSchema>;
