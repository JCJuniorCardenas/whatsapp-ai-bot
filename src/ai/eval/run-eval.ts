/**
 * Corre la evaluación de la IA contra modelos reales de Gemini.
 *
 *   npm run eval:ai                                  (usa AI_MODEL del .env)
 *   npm run eval:ai -- --models gemini-3.5-flash-lite,gemini-3.8-flash --write
 *   npm run eval:ai -- --only res-lunes-10,seg-tema --delay 5000
 *
 * Gasta cuota real del plan gratis de Gemini (unas 2 a 3 llamadas por caso).
 */
import { ThinkingLevel } from '@google/genai';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { GeminiProvider } from '../gemini.provider';
import { EVAL_CASES } from './eval-cases';
import { renderReport } from './eval-report';
import { CaseResult, runEval, summarize } from './eval-runner';

try {
  process.loadEnvFile();
} catch {
  // sin .env: se usan las variables que ya estén en el entorno
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('Falta GEMINI_API_KEY (en el .env o en el entorno).');
    process.exit(1);
  }

  const models = (arg('models') ?? process.env.AI_MODEL ?? 'gemini-3.5-flash-lite').split(',').map((m) => m.trim());
  const delayMs = Number(arg('delay') ?? 3000);
  const only = arg('only')?.split(',');
  const cases = only ? EVAL_CASES.filter((c) => only.includes(c.id)) : EVAL_CASES;
  if (cases.length === 0) {
    console.error(`Ningún caso coincide con --only ${only?.join(',')}`);
    process.exit(1);
  }
  const level = (process.env.AI_THINKING_LEVEL ?? 'LOW').toUpperCase();
  const thinking = level === 'NONE' ? undefined : (level as ThinkingLevel);
  const date = new Date().toISOString().slice(0, 10);

  const summaries: { model: string; results: CaseResult[] }[] = [];
  for (const model of models) {
    console.log(`\n=== ${model}: ${cases.length} casos ===`);
    const provider = new GeminiProvider(apiKey, model, thinking);
    const results = await runEval(cases, provider, {
      delayMs,
      onResult: (r, i, total) => {
        const mark = r.outcome === 'pass' ? '✓' : r.outcome === 'fail' ? '✗' : '!';
        console.log(`${mark} [${i + 1}/${total}] ${r.id} (${(r.latencyMs / 1000).toFixed(1)} s)${r.outcome === 'pass' ? '' : `: ${r.detail}`}`);
      },
    });
    summaries.push({ model, results });

    const s = summarize(results);
    console.log(
      `→ ${s.passed}/${s.passed + s.failed} aciertos${s.accuracy === null ? '' : ` (${(s.accuracy * 100).toFixed(1)} %)`}, ${s.infra} sin resultado por el proveedor, ${(s.avgLatencyMs / 1000).toFixed(1)} s promedio`,
    );

    if (process.argv.includes('--write')) {
      const dir = join(process.cwd(), 'docs', 'evals');
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `ai-eval-${model}.md`);
      writeFileSync(file, renderReport(model, date, results), 'utf8');
      console.log(`Informe guardado en ${file}`);
    }
  }

  if (summaries.length > 1) {
    console.log('\n=== Comparación ===');
    for (const { model, results } of summaries) {
      const s = summarize(results);
      console.log(
        `${model.padEnd(28)} ${s.accuracy === null ? 's/d' : `${(s.accuracy * 100).toFixed(1)} %`.padStart(7)}  ${(s.avgLatencyMs / 1000).toFixed(1)} s  (${s.infra} sin resultado)`,
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
