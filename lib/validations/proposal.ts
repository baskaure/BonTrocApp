import { z } from 'zod';

// Limites serveur : proposals_text_lengths (message ≤ 2000, offre ≤ 2000). Comme sur le site,
// l'offre est obligatoire (5 caractères min.) et le message d'accompagnement facultatif.
export const counterProposalSchema = z.object({
  counterOffer: z.string().trim().min(5, 'Décrivez votre contre-proposition (5 caractères minimum)').max(2000, 'Texte trop long (2000 caractères max)'),
  counterMessage: z.string().trim().max(2000, 'Message trop long (2000 caractères max)').optional(),
});

export const proposalSchema = z.object({
  offer: z.string().trim().min(5, 'Décrivez votre contrepartie (5 caractères minimum)').max(2000, 'Texte trop long (2000 caractères max)'),
  message: z.string().trim().max(2000, 'Message trop long (2000 caractères max)').optional(),
});

export type CounterProposalFormData = z.infer<typeof counterProposalSchema>;
export type ProposalFormData = z.infer<typeof proposalSchema>;
