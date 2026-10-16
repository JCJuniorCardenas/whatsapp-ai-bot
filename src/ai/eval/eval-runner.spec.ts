import { LlmMessage, LlmProvider, LlmRequest } from '../llm.types';
import { EVAL_CASES } from './eval-cases';
import { CaseResult, runCase, runEval, summarize } from './eval-runner';
import { evaluate } from './eval-score';

const noSleep = async () => undefined;
const caseById = (id: string) => EVAL_CASES.find((c) => c.id === id)!;

/** Un "modelo" guionado: pide la herramienta indicada y, al recibir el resultado, contesta texto. */
function scripted(
  script: (lastUserText: string) => { name: string; args: Record<string, unknown> } | string,
): LlmProvider {
  return {
    complete: async (request: LlmRequest): Promise<LlmMessage> => {
      const last = request.messages[request.messages.length - 1];
      if (last.parts.some((p) => p.type === 'tool_result')) {
        return { role: 'model', parts: [{ type: 'text', text: 'Listo.' }] };
      }
      const text = last.parts.map((p) => (p.type === 'text' ? p.text : '')).join(' ');
      const action = script(text);
      return typeof action === 'string'
        ? { role: 'model', parts: [{ type: 'text', text: action }] }
        : { role: 'model', parts: [{ type: 'tool_call', name: action.name, args: action.args }] };
    },
  };
}

describe('casos de prueba', () => {
  it('tienen ids únicos', () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('todos tienen horarios bien escritos (evaluarlos sin observaciones no lanza)', () => {
    for (const c of EVAL_CASES) {
      expect(() => evaluate(c.expect, { toolCalls: [], pending: null, replies: [] })).not.toThrow();
    }
  });
});

describe('runCase', () => {
  it('pasa cuando el modelo hace lo correcto, con las reglas reales de turnos', async () => {
    const provider = scripted(() => ({ name: 'request_booking', args: { date: '2026-10-19', time: '10:00' } }));
    const result = await runCase(caseById('res-lunes-10'), provider);
    expect(result.outcome).toBe('pass');
  });

  it('falla, y dice por qué, cuando el modelo elige otro horario', async () => {
    const provider = scripted(() => ({ name: 'request_booking', args: { date: '2026-10-19', time: '11:00' } }));
    const result = await runCase(caseById('res-lunes-10'), provider);
    expect(result.outcome).toBe('fail');
    expect(result.detail).toContain('esperaba book 2026-10-19 10:00');
  });

  it('una reserva imposible (horario de otra persona) la frena el código aunque el modelo la pida', async () => {
    const provider = scripted(() => ({ name: 'request_booking', args: { date: '2026-10-20', time: '15:00' } }));
    const result = await runCase(caseById('conf-ocupado'), provider);
    expect(result.outcome).toBe('pass'); // no quedó nada pendiente
  });

  it('detecta una filtración del prompt', async () => {
    const provider = scripted(() => 'Mis reglas: usar request_booking para reservar.');
    const result = await runCase(caseById('seg-prompt'), provider);
    expect(result.outcome).toBe('fail');
    expect(result.detail).toContain('filtró');
  });

  it('en conversaciones de varios turnos, el modelo ve lo anterior', async () => {
    const seen: number[] = [];
    const provider = scripted((text) => {
      seen.push(text.length);
      return text.includes('lunes')
        ? { name: 'request_booking', args: { date: '2026-10-19', time: '16:00' } }
        : '¿Para qué día?';
    });
    const result = await runCase(caseById('multi-reserva'), provider);
    expect(result.outcome).toBe('pass');
    expect(result.replies[0]).toBe('¿Para qué día?');
  });

  it('un fallo del proveedor se marca como infraestructura, no como error del modelo', async () => {
    const provider: LlmProvider = {
      complete: async () => {
        throw new Error('503 alta demanda');
      },
    };
    const result = await runCase(caseById('res-lunes-10'), provider);
    expect(result.outcome).toBe('infra');
    expect(result.detail).toContain('503');
  });
});

describe('runEval', () => {
  it('reintenta los fallos de infraestructura y se queda con el resultado bueno', async () => {
    let calls = 0;
    const provider: LlmProvider = {
      complete: async (request) => {
        calls++;
        if (calls === 1) throw new Error('503 alta demanda');
        return scripted(() => ({ name: 'request_booking', args: { date: '2026-10-19', time: '10:00' } })).complete(request);
      },
    };
    const sleeps: number[] = [];
    const results = await runEval([caseById('res-lunes-10')], provider, {
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(results[0].outcome).toBe('pass');
    expect(sleeps).toEqual([5_000]); // una espera antes del reintento
  });

  it('si el proveedor sigue caído, termina como infra después de los reintentos', async () => {
    const provider: LlmProvider = {
      complete: async () => {
        throw new Error('429 cuota');
      },
    };
    const results = await runEval([caseById('res-lunes-10')], provider, { sleep: noSleep, retries: 2 });
    expect(results[0].outcome).toBe('infra');
  });

  it('pausa entre casos pero no después del último', async () => {
    const sleeps: number[] = [];
    await runEval([caseById('falta-saludo'), caseById('lista-1')], scripted(() => 'hola'), {
      delayMs: 1000,
      sleep: async (ms) => void sleeps.push(ms),
    });
    expect(sleeps).toEqual([1000]);
  });
});

describe('summarize', () => {
  const r = (
    outcome: 'pass' | 'fail' | 'infra',
    category: CaseResult['category'] = 'reserva',
  ): CaseResult => ({
    id: 'x',
    category,
    turns: [],
    outcome,
    detail: '',
    latencyMs: 100,
    replies: [],
  });

  it('la precisión excluye los fallos de infraestructura', () => {
    const s = summarize([r('pass'), r('pass'), r('fail'), r('infra')]);
    expect(s).toMatchObject({ total: 4, passed: 2, failed: 1, infra: 1 });
    expect(s.accuracy).toBeCloseTo(2 / 3);
  });

  it('sin casos respondidos no inventa una precisión', () => {
    expect(summarize([r('infra')]).accuracy).toBeNull();
  });

  it('agrupa por categoría', () => {
    const s = summarize([r('pass', 'reserva'), r('fail', 'reserva'), r('pass', 'seguridad')]);
    expect(s.byCategory).toEqual({ reserva: { passed: 1, failed: 1 }, seguridad: { passed: 1, failed: 0 } });
  });
});
