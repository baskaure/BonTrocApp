import { z } from 'zod';

export const profileSchema = z.object({
  display_name: z.string().min(2, 'Le nom doit faire au moins 2 caractères'),
  username: z
    .string()
    .min(2, "Le nom d'utilisateur doit faire au moins 2 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et underscores uniquement"),
  bio: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  languages: z.array(z.string()),
  skills: z.array(z.string()),
  search_radius_km: z.number().min(1).max(500),
  avatar_url: z.string().optional(),
  banner_url: z.string().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
