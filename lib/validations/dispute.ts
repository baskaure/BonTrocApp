import { z } from 'zod';

export const disputeSchema = z.object({
  reason: z.string().min(10, 'Veuillez décrire le problème (min. 10 caractères)'),
});

export type DisputeFormData = z.infer<typeof disputeSchema>;
