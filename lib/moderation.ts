import { supabase } from './supabase';

type BannedWord = { word: string; severity: 'warning' | 'block' };

let cache: { words: BannedWord[]; loadedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60_000;

/** Minuscules sans accents, pour comparer « réputé » et « repute » de la même façon. */
export function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function loadBannedWords(): Promise<BannedWord[]> {
  if (cache && Date.now() - cache.loadedAt < CACHE_TTL_MS) return cache.words;
  const { data, error } = await supabase.from('banned_words').select('word, severity');
  if (error || !data) {
    if (error) console.warn('Liste des mots interdits indisponible', error.message);
    return cache?.words ?? [];
  }
  const words = data
    .map((row) => ({
      word: normalizeText(String(row.word ?? '').trim()),
      severity: (row.severity === 'block' ? 'block' : 'warning') as BannedWord['severity'],
    }))
    .filter((w) => w.word.length > 0);
  cache = { words, loadedAt: Date.now() };
  return words;
}

export type ModerationResult = {
  hasWarning: boolean;
  hasBlock: boolean;
  detectedWords: string[];
  warningWords: string[];
  blockWords: string[];
};

/**
 * Détecte les termes interdits en respectant les frontières de mots (« calcul » ne déclenche
 * pas « cul »). Le serveur applique la même règle pour les termes bloquants (trigger
 * `moderate_row`) ; ici on prévient l'utilisateur avant l'envoi et on journalise les incidents.
 *
 * Le texte est normalisé (minuscules, sans accents) : les frontières se limitent donc à
 * `[a-z0-9_]`, ce qui évite les classes Unicode non prises en charge par tous les moteurs.
 */
export async function checkContent(content: string, userId?: string): Promise<ModerationResult> {
  const words = await loadBannedWords();
  const haystack = normalizeText(content);
  const detected: BannedWord[] = [];

  for (const entry of words) {
    const pattern = new RegExp(`(^|[^a-z0-9_])${escapeRegExp(entry.word)}(?=$|[^a-z0-9_])`);
    if (pattern.test(haystack)) detected.push(entry);
  }

  const detectedWords = detected.map((d) => d.word);
  const warningWords = detected.filter((d) => d.severity === 'warning').map((d) => d.word);
  const blockWords = detected.filter((d) => d.severity === 'block').map((d) => d.word);
  const hasWarning = warningWords.length > 0;
  const hasBlock = blockWords.length > 0;

  if (detected.length > 0 && userId) {
    void supabase.from('moderation_logs').insert({
      user_id: userId,
      action_type: hasBlock ? 'blocked_content' : 'warning_content',
      content: content.substring(0, 500),
      detected_words: detectedWords,
    });
  }

  return { hasWarning, hasBlock, detectedWords, warningWords, blockWords };
}

/** Message d'erreur prêt à afficher quand un texte contient un terme bloquant. */
export function blockedMessage(result: ModerationResult, what = 'Le texte'): string {
  return `${what} contient un terme interdit (${result.blockWords.join(', ')}).`;
}
