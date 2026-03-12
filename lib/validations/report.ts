import { z } from 'zod';

export const reportSchema = z
  .object({
    reason: z.enum(['spam', 'inappropriate', 'fraud', 'harassment', 'fake', 'other']).optional(),
    details: z.string().optional(),
  })
  .refine((data) => !!data.reason, {
    message: 'Veuillez sélectionner un motif',
    path: ['reason'],
  });

export type ReportFormData = z.infer<typeof reportSchema>;
