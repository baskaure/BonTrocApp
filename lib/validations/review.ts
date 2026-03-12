import { z } from 'zod';

export const reviewSchema = z
  .object({
    rating: z.number().min(0).max(5),
    comment: z.string().optional(),
    tags: z.array(z.string()),
  })
  .refine((data) => data.rating >= 1, {
    message: 'Veuillez donner une note',
    path: ['rating'],
  });

export type ReviewFormData = z.infer<typeof reviewSchema>;
