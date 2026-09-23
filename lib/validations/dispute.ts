import { z } from 'zod';

// Limite serveur : disputes_reason_length (5 à 3000 caractères).
export const disputeSchema = z.object({
  reason: z.string().trim().min(10, 'Veuillez décrire le problème (min. 10 caractères)').max(3000, 'Description trop longue (3000 caractères max)'),
});

export type DisputeFormData = z.infer<typeof disputeSchema>;
