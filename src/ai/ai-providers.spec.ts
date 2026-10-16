import { buildProviderEntries, DEFAULT_FALLBACK_MODEL, DEFAULT_MODEL } from './ai-providers';
import { LlmProvider } from './llm.types';

const from = (env: Record<string, string>) => (key: string) => env[key];
const make = (model: string): LlmProvider => ({ complete: jest.fn(), model }) as unknown as LlmProvider;
const names = (entries: { name: string }[]) => entries.map((e) => e.name);

describe('buildProviderEntries', () => {
  it('sin GEMINI_API_KEY la IA queda apagada (lista vacía)', () => {
    expect(buildProviderEntries(from({}), make)).toEqual([]);
  });

  it('por defecto: modelo principal y modelo de respaldo, con tiempos distintos', () => {
    const entries = buildProviderEntries(from({ GEMINI_API_KEY: 'k' }), make);
    expect(names(entries)).toEqual([DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]);
    expect(entries.map((e) => e.timeoutMs)).toEqual([12_000, 20_000]);
  });

  it('cada entrada tiene su propio proveedor creado con su modelo', () => {
    const created: string[] = [];
    buildProviderEntries(from({ GEMINI_API_KEY: 'k' }), (m) => {
      created.push(m);
      return make(m);
    });
    expect(created).toEqual([DEFAULT_MODEL, DEFAULT_FALLBACK_MODEL]);
  });

  it('se pueden elegir los modelos por variable', () => {
    const entries = buildProviderEntries(
      from({ GEMINI_API_KEY: 'k', AI_MODEL: 'gemini-a', AI_FALLBACK_MODEL: 'gemini-b' }),
      make,
    );
    expect(names(entries)).toEqual(['gemini-a', 'gemini-b']);
  });

  it('AI_FALLBACK_MODEL=none desactiva el respaldo y el principal usa el tiempo completo', () => {
    const entries = buildProviderEntries(from({ GEMINI_API_KEY: 'k', AI_FALLBACK_MODEL: 'NONE' }), make);
    expect(names(entries)).toEqual([DEFAULT_MODEL]);
    expect(entries[0].timeoutMs).toBe(20_000);
  });

  it('si el respaldo es el mismo modelo que el principal, no se duplica', () => {
    const entries = buildProviderEntries(
      from({ GEMINI_API_KEY: 'k', AI_MODEL: 'gemini-a', AI_FALLBACK_MODEL: 'gemini-a' }),
      make,
    );
    expect(names(entries)).toEqual(['gemini-a']);
  });

  it('los tiempos se pueden ajustar y un valor inválido vuelve al por defecto', () => {
    const custom = buildProviderEntries(
      from({ GEMINI_API_KEY: 'k', AI_PRIMARY_TIMEOUT_MS: '8000', AI_TIMEOUT_MS: '25000' }),
      make,
    );
    expect(custom.map((e) => e.timeoutMs)).toEqual([8_000, 25_000]);

    const invalid = buildProviderEntries(
      from({ GEMINI_API_KEY: 'k', AI_PRIMARY_TIMEOUT_MS: 'abc', AI_TIMEOUT_MS: '-5' }),
      make,
    );
    expect(invalid.map((e) => e.timeoutMs)).toEqual([12_000, 20_000]);
  });
});
