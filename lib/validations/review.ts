import { z } from 'zod';

// Limites serveur : reviews_rating_range (1 à 5) et reviews_comment_length (≤ 1500).
export const reviewSchema = z
  .object({
    rating: z.number().min(0).max(5),
    comment: z.string().max(1500, 'Commentaire trop long (1500 caractères max)').optional(),
    tags: z.array(z.string()),
  })
  .refine((data) => data.rating >= 1, {
    message: 'Veuillez donner une note',
    path: ['rating'],
  });

export type ReviewFormData = z.infer<typeof reviewSchema>;
