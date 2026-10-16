import { CaseResult } from './eval-runner';
import { renderReport } from './eval-report';

const r = (
  id: string,
  outcome: CaseResult['outcome'],
  detail = '',
  category: CaseResult['category'] = 'reserva',
): CaseResult => ({ id, category, turns: ['quiero turno'], outcome, detail, latencyMs: 2000, replies: [] });

describe('renderReport', () => {
  const report = renderReport('modelo-x', '2026-10-16', [
    r('a', 'pass'),
    r('b', 'pass'),
    r('c', 'fail', 'esperaba book 2026-10-19 10:00; quedó: ninguna'),
    r('d', 'infra', 'falló el proveedor: 503'),
  ]);

  it('resume los números con la precisión sobre los casos respondidos', () => {
    expect(report).toContain('# Evaluación de la IA: modelo-x');
    expect(report).toContain('**Casos:** 4 (3 respondidos por el modelo, 1 con fallo de infraestructura)');
    expect(report).toContain('**Aciertos:** 2 de 3 (66,7 %)');
    expect(report).toContain('**Latencia promedio por caso:** 2,0 s');
  });

  it('incluye la tabla por categoría', () => {
    expect(report).toContain('| reserva | 2 | 3 |');
  });

  it('lista los fallos con el motivo', () => {
    expect(report).toContain('## Casos que fallaron');
    expect(report).toContain('`c`: "quiero turno": esperaba book 2026-10-19 10:00');
  });

  it('lista aparte los casos sin resultado por infraestructura', () => {
    expect(report).toContain('## Casos sin resultado');
    expect(report).toContain('`d`: falló el proveedor: 503');
  });

  it('sin fallos no muestra la sección de fallos', () => {
    expect(renderReport('m', '2026-10-16', [r('a', 'pass')])).not.toContain('## Casos que fallaron');
  });
});
