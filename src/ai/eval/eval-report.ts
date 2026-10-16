import { CaseResult, summarize } from './eval-runner';

const pct = (n: number) => `${(n * 100).toFixed(1).replace('.', ',')} %`;
const secs = (ms: number) => `${(ms / 1000).toFixed(1).replace('.', ',')} s`;

/** Informe en Markdown de una corrida de la evaluación. */
export function renderReport(model: string, date: string, results: CaseResult[]): string {
  const s = summarize(results);
  const answered = s.passed + s.failed;
  const lines: string[] = [
    `# Evaluación de la IA: ${model}`,
    '',
    `- **Fecha:** ${date}`,
    `- **Casos:** ${s.total} (${answered} respondidos por el modelo, ${s.infra} con fallo de infraestructura)`,
    `- **Aciertos:** ${s.passed} de ${answered}${s.accuracy === null ? '' : ` (${pct(s.accuracy)})`}`,
    `- **Latencia promedio por caso:** ${secs(s.avgLatencyMs)}`,
    '',
    '| Categoría | Aciertos | Total |',
    '|---|---|---|',
    ...Object.entries(s.byCategory).map(
      ([category, c]) => `| ${category} | ${c.passed} | ${c.passed + c.failed} |`,
    ),
  ];

  const failures = results.filter((r) => r.outcome === 'fail');
  if (failures.length > 0) {
    lines.push('', '## Casos que fallaron', '');
    for (const f of failures) {
      lines.push(`- \`${f.id}\`: "${f.turns.join('" → "')}": ${f.detail}`);
    }
  }
  const infra = results.filter((r) => r.outcome === 'infra');
  if (infra.length > 0) {
    lines.push('', '## Casos sin resultado (falló el proveedor)', '');
    for (const f of infra) lines.push(`- \`${f.id}\`: ${f.detail}`);
  }
  lines.push(
    '',
    '> Cada caso corre contra las reglas reales de turnos con una base en memoria y una fecha fija',
    '> (jueves 15/10/2026 12:00). Se mide el **estado final** (qué quedó pendiente, qué herramientas',
    '> usó), no el texto de la respuesta. Se reproduce con `npm run eval:ai`.',
    '',
  );
  return lines.join('\n');
}
