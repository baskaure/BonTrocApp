import { z } from 'zod';

// Limite serveur : chat_messages_body_length (1 à 2000 caractères).
export const chatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Le message ne peut pas être vide').max(2000, 'Message trop long (max 2000 caractères)'),
});

export type ChatMessageFormData = z.infer<typeof chatMessageSchema>;
