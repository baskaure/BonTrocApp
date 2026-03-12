import { z } from 'zod';

export const counterProposalSchema = z.object({
  counterOffer: z.string().min(3, 'Décrivez ce que vous proposez (min. 3 caractères)'),
  counterMessage: z.string().min(3, 'Ajoutez un message (min. 3 caractères)'),
});

export const proposalSchema = z.object({
  message: z.string().min(3, 'Le message doit faire au moins 3 caractères'),
  offer: z.string().min(3, "Décrivez ce que vous proposez (min. 3 caractères)"),
});

export type CounterProposalFormData = z.infer<typeof counterProposalSchema>;
export type ProposalFormData = z.infer<typeof proposalSchema>;
