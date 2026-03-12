import { z } from 'zod';

export const chatMessageSchema = z.object({
  message: z.string().min(1, 'Le message ne peut pas être vide').max(500, 'Message trop long (max 500 caractères)'),
});

export type ChatMessageFormData = z.infer<typeof chatMessageSchema>;
