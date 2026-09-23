import { z } from 'zod';
import { USERNAME_RE } from '@/lib/labels';

// Limites serveur : users_text_lengths (nom 1–60, pseudo 3–30, bio ≤ 800, ville/pays ≤ 80, téléphone ≤ 30).
export const profileSchema = z.object({
  display_name: z.string().trim().min(2, 'Le nom doit faire au moins 2 caractères').max(60, 'Le nom est trop long (60 caractères max)'),
  username: z.string().trim().regex(USERNAME_RE, '3 à 30 caractères : lettres minuscules, chiffres et underscores uniquement'),
  bio: z.string().max(800, 'La biographie est trop longue (800 caractères max)').optional(),
  phone: z.string().max(30, 'Numéro trop long').optional(),
  city: z.string().max(80, 'Ville trop longue').optional(),
  country: z.string().max(80, 'Pays trop long').optional(),
  languages: z.array(z.string()),
  skills: z.array(z.string()),
  search_radius_km: z.number().min(1).max(500),
  avatar_url: z.string().optional(),
  banner_url: z.string().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;
