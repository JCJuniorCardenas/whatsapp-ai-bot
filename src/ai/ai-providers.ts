import { LlmProvider, LlmProviderEntry } from './llm.types';

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';
const LAST_TIMEOUT_MS = 20_000;
const PRIMARY_TIMEOUT_WITH_FALLBACK_MS = 12_000;

type Getter = (key: string) => string | undefined;

/**
 * Arma la lista de modelos en orden de preferencia: el principal y, si hay, uno de respaldo.
 * Sin GEMINI_API_KEY devuelve una lista vacía (la IA queda apagada).
 *
 * Variables: AI_MODEL, AI_FALLBACK_MODEL ("none" lo desactiva), AI_PRIMARY_TIMEOUT_MS, AI_TIMEOUT_MS.
 */
export function buildProviderEntries(
  get: Getter,
  create: (model: string) => LlmProvider,
): LlmProviderEntry[] {
  if (!get('GEMINI_API_KEY')) return [];

  const primary = get('AI_MODEL') || DEFAULT_MODEL;
  const fallbackSetting = get('AI_FALLBACK_MODEL') || DEFAULT_FALLBACK_MODEL;
  const fallback =
    fallbackSetting.toLowerCase() === 'none' || fallbackSetting === primary ? null : fallbackSetting;

  const lastTimeout = positive(get('AI_TIMEOUT_MS'), LAST_TIMEOUT_MS);
  const primaryTimeout = fallback
    ? positive(get('AI_PRIMARY_TIMEOUT_MS'), PRIMARY_TIMEOUT_WITH_FALLBACK_MS)
    : lastTimeout;

  const entries: LlmProviderEntry[] = [
    { name: primary, provider: create(primary), timeoutMs: primaryTimeout },
  ];
  if (fallback) {
    entries.push({ name: fallback, provider: create(fallback), timeoutMs: lastTimeout });
  }
  return entries;
}

function positive(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
