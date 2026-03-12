import { z } from 'zod';

export const createListingSchema = z.object({
  type: z.enum(['service', 'product']),
  title: z.string().min(3, 'Le titre doit faire au moins 3 caractères').max(100, 'Le titre est trop long'),
  description_offer: z.string().min(10, 'Décrivez ce que vous offrez (min. 10 caractères)'),
  desired_exchange_desc: z.string().min(10, 'Décrivez ce que vous cherchez (min. 10 caractères)'),
  mode: z.enum(['remote', 'on_site', 'both']),
  estimation_min: z.string().optional(),
  estimation_max: z.string().optional(),
});

export type CreateListingFormData = z.infer<typeof createListingSchema>;
