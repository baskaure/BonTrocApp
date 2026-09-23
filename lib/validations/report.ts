import { z } from 'zod';

// Limite serveur : reports_details_length (≤ 2000).
export const reportSchema = z
  .object({
    reason: z.enum(['spam', 'inappropriate', 'fraud', 'harassment', 'fake', 'other']).optional(),
    details: z.string().max(2000, 'Détails trop longs (2000 caractères max)').optional(),
  })
  .refine((data) => !!data.reason, {
    message: 'Veuillez sélectionner un motif',
    path: ['reason'],
  });

export type ReportFormData = z.infer<typeof reportSchema>;
