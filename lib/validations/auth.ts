import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
});

export const registerSchema = loginSchema.extend({
  displayName: z.string().min(2, 'Le nom doit faire au moins 2 caractères'),
  username: z
    .string()
    .min(2, "Le nom d'utilisateur doit faire au moins 2 caractères")
    .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et underscores uniquement"),
});

export type LoginFormData = z.infer<typeof loginSchema>;
export type RegisterFormData = z.infer<typeof registerSchema>;
