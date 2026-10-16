import { ConfigService } from '@nestjs/config';
import { AiService } from '../ai.service';
import { LlmMessage, LlmProvider, LlmRequest } from '../llm.types';
import { EvalCase } from './eval-cases';
import { evaluate, Observed } from './eval-score';
import { createWorld, EVAL_NOW } from './eval-world';

export interface CaseResult {
  id: string;
  category: EvalCase['category'];
  turns: string[];
  /** 'infra' = falló el proveedor (saturación, cuota…): no se le cuenta al modelo. */
  outcome: 'pass' | 'fail' | 'infra';
  detail: string;
  latencyMs: number;
  replies: (string | null)[];
}

/** Envuelve un proveedor para registrar qué herramientas pidió el modelo y si el proveedor falló. */
class RecordingProvider implements LlmProvider {
  readonly toolCalls: Observed['toolCalls'] = [];
  readonly errors: string[] = [];
  /** Llamadas que todavía no respondieron. Si al terminar queda alguna, el servicio cortó por tiempo. */
  inFlight = 0;

  constructor(private readonly inner: LlmProvider) {}

  async complete(request: LlmRequest): Promise<LlmMessage> {
    this.inFlight++;
    try {
      const answer = await this.inner.complete(request);
      for (const part of answer.parts) {
        if (part.type === 'tool_call') this.toolCalls.push({ name: part.name, args: part.args });
      }
      return answer;
    } catch (err) {
      this.errors.push((err as Error).message);
      throw err;
    } finally {
      this.inFlight--;
    }
  }
}

/** Corre una conversación en un mundo limpio y la evalúa. */
export async function runCase(evalCase: EvalCase, provider: LlmProvider): Promise<CaseResult> {
  const world = createWorld();
  const recorder = new RecordingProvider(provider);
  const ai = new AiService(
    recorder,
    new ConfigService({ AI_DAILY_LIMIT: '1000' }),
    world.appointments,
    world.contacts,
    world.messages as never,
  );

  const started = Date.now();
  const replies: (string | null)[] = [];
  for (const text of evalCase.turns) {
    world.history.push({ direction: 'in', body: text });
    const pending = world.contacts.getPending(world.contact, EVAL_NOW);
    const reply = await ai.reply(world.contact, text, EVAL_NOW, pending);
    replies.push(reply);
    if (reply) world.history.push({ direction: 'out', body: reply });
  }
  const latencyMs = Date.now() - started;
  const base = { id: evalCase.id, category: evalCase.category, turns: evalCase.turns, latencyMs, replies };

  if (recorder.errors.length > 0) {
    return { ...base, outcome: 'infra', detail: `falló el proveedor: ${recorder.errors[0].slice(0, 160)}` };
  }
  if (recorder.inFlight > 0) {
    // El servicio dejó de esperar: es lentitud del proveedor, no una respuesta equivocada del modelo.
    return { ...base, outcome: 'infra', detail: 'el proveedor no respondió a tiempo (timeout)' };
  }
  const observed: Observed = {
    toolCalls: recorder.toolCalls,
    pending: world.contacts.getPending(world.contact, EVAL_NOW),
    replies,
  };
  const verdict = evaluate(evalCase.expect, observed);
  return { ...base, outcome: verdict.passed ? 'pass' : 'fail', detail: verdict.detail };
}

export interface RunOptions {
  /** Pausa entre casos, para no pasarse del límite del plan gratis. */
  delayMs?: number;
  /** Cuántas veces se reintenta un caso si falla el proveedor. */
  retries?: number;
  sleep?: (ms: number) => Promise<void>;
  onResult?: (result: CaseResult, index: number, total: number) => void;
}

const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function runEval(
  cases: EvalCase[],
  provider: LlmProvider,
  { delayMs = 0, retries = 2, sleep = realSleep, onResult }: RunOptions = {},
): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const [index, evalCase] of cases.entries()) {
    let result = await runCase(evalCase, provider);
    for (let attempt = 1; result.outcome === 'infra' && attempt <= retries; attempt++) {
      await sleep(5_000 * attempt * attempt); // 5 s, 20 s, 45 s…
      result = await runCase(evalCase, provider);
    }
    results.push(result);
    onResult?.(result, index, cases.length);
    if (delayMs > 0 && index < cases.length - 1) await sleep(delayMs);
  }
  return results;
}

export interface Summary {
  total: number;
  passed: number;
  failed: number;
  infra: number;
  /** Aciertos sobre los casos que el modelo llegó a responder (excluye fallos de infraestructura). */
  accuracy: number | null;
  avgLatencyMs: number;
  byCategory: Record<string, { passed: number; failed: number }>;
}

export function summarize(results: CaseResult[]): Summary {
  const passed = results.filter((r) => r.outcome === 'pass').length;
  const failed = results.filter((r) => r.outcome === 'fail').length;
  const byCategory: Summary['byCategory'] = {};
  for (const r of results) {
    if (r.outcome === 'infra') continue;
    const bucket = (byCategory[r.category] ??= { passed: 0, failed: 0 });
    if (r.outcome === 'pass') bucket.passed++;
    else bucket.failed++;
  }
  const answered = results.filter((r) => r.outcome !== 'infra');
  return {
    total: results.length,
    passed,
    failed,
    infra: results.length - passed - failed,
    accuracy: passed + failed === 0 ? null : passed / (passed + failed),
    avgLatencyMs: answered.length ? Math.round(answered.reduce((s, r) => s + r.latencyMs, 0) / answered.length) : 0,
    byCategory,
  };
}
