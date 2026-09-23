import { z } from 'zod';
import { USERNAME_RE } from '@/lib/labels';

// Règles alignées sur le site et sur la base : mot de passe ≥ 8 (réglage Supabase en production),
// pseudo 3 à 30 caractères en minuscules (contrainte users_text_lengths + index unique sans casse).
export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit faire au moins 8 caractères'),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().trim().min(2, 'Le nom doit faire au moins 2 caractères').max(60, 'Le nom est trop long (60 caractères max)'),
  username: z
    .string()
    .trim()
    .regex(USERNAME_RE, "3 à 30 caractères : lettres minuscules, chiffres et underscores uniquement"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
