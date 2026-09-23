import { supabase } from './supabase';

type EmailVariables = Record<string, string | number | undefined | null>;

/** Modèles qu'un client a le droit de déclencher (Edge Function `send-email`, allowlist serveur). */
export type ClientEmailTemplate = 'welcome' | 'new_proposal' | 'counter_proposal' | 'new_chat_message' | 'new_review';

const sanitizeVariables = (variables: EmailVariables) =>
  Object.entries(variables).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[key] = String(value).slice(0, 500);
    return acc;
  }, {});

/**
 * Demande l'envoi d'un e-mail transactionnel. Le destinataire est identifié par son id :
 * l'Edge Function résout l'adresse, vérifie que l'appelant est bien lié au destinataire et
 * applique ses préférences de notification. Ne bloque jamais l'action utilisateur.
 *
 * Même contrat que `src/lib/notifications.ts` du site.
 */
export async function sendTransactionalEmail(
  templateName: ClientEmailTemplate,
  recipientUserId: string | undefined | null,
  variables: EmailVariables = {},
): Promise<void> {
  if (!recipientUserId) return;
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: {
        template_name: templateName,
        recipient_user_id: recipientUserId,
        variables: sanitizeVariables(variables),
      },
    });
    if (error) {
      console.warn(`E-mail ${templateName} non envoyé :`, error.message ?? error);
    } else if (data && data.success === false && data.error) {
      console.warn(`E-mail ${templateName} en échec :`, data.error);
    }
  } catch (err) {
    console.warn(`E-mail ${templateName} : appel impossible`, err);
  }
}
