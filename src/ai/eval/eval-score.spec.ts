import { fromLocal } from '../../appointments/schedule';
import { evaluate, Expectation, Observed } from './eval-score';

const slotIso = (y: number, m: number, d: number, h: number, min: number) =>
  fromLocal(y, m, d, h, min).toISOString();

const empty: Observed = { toolCalls: [], pending: null, replies: [] };
const withCalls = (...names: string[]): Observed => ({
  ...empty,
  toolCalls: names.map((name) => ({ name, args: {} })),
});

describe('evaluate', () => {
  describe('availability', () => {
    const expected: Expectation = { kind: 'availability', date: '2026-10-19', partOfDay: 'afternoon' };

    it('pasa si consultó ese día y esa franja', () => {
      const o: Observed = {
        ...empty,
        toolCalls: [{ name: 'get_availability', args: { date: '2026-10-19', part_of_day: 'afternoon' } }],
      };
      expect(evaluate(expected, o).passed).toBe(true);
    });

    it('falla si consultó otro día, y lo cuenta', () => {
      const o: Observed = {
        ...empty,
        toolCalls: [{ name: 'get_availability', args: { date: '2026-10-20', part_of_day: 'afternoon' } }],
      };
      const v = evaluate(expected, o);
      expect(v.passed).toBe(false);
      expect(v.detail).toContain('2026-10-20');
    });

    it('no exige franja si el caso no la pide', () => {
      const o: Observed = { ...empty, toolCalls: [{ name: 'get_availability', args: { date: '2026-10-16' } }] };
      expect(evaluate({ kind: 'availability', date: '2026-10-16' }, o).passed).toBe(true);
    });
  });

  describe('book / cancel', () => {
    it('book pasa si quedó pendiente exactamente ese horario', () => {
      const o: Observed = {
        ...empty,
        pending: { type: 'book', startsAt: slotIso(2026, 10, 19, 10, 0) },
      };
      expect(evaluate({ kind: 'book', slot: '2026-10-19 10:00' }, o).passed).toBe(true);
    });

    it('book falla si es otro horario o otro tipo de acción', () => {
      const otraHora: Observed = { ...empty, pending: { type: 'book', startsAt: slotIso(2026, 10, 19, 10, 30) } };
      const otraAccion: Observed = { ...empty, pending: { type: 'cancel', startsAt: slotIso(2026, 10, 19, 10, 0) } };
      expect(evaluate({ kind: 'book', slot: '2026-10-19 10:00' }, otraHora).passed).toBe(false);
      expect(evaluate({ kind: 'book', slot: '2026-10-19 10:00' }, otraAccion).passed).toBe(false);
    });

    it('cancel pasa con la cancelación correcta', () => {
      const o: Observed = { ...empty, pending: { type: 'cancel', startsAt: slotIso(2026, 10, 20, 10, 30) } };
      expect(evaluate({ kind: 'cancel', slot: '2026-10-20 10:30' }, o).passed).toBe(true);
    });

    it('rechaza un horario mal escrito en el caso (error del autor del caso)', () => {
      expect(() => evaluate({ kind: 'book', slot: 'mañana' }, empty)).toThrow('mal escrito');
    });
  });

  describe('cancel_or_lookup', () => {
    const expected: Expectation = { kind: 'cancel_or_lookup', slot: '2026-10-20 10:30' };

    it('pasa si cancela el turno correcto', () => {
      const o: Observed = { ...empty, pending: { type: 'cancel', startsAt: slotIso(2026, 10, 20, 10, 30) } };
      expect(evaluate(expected, o).passed).toBe(true);
    });

    it('pasa si consulta los turnos y no actúa todavía', () => {
      expect(evaluate(expected, withCalls('list_my_appointments')).passed).toBe(true);
    });

    it('falla si cancela un turno equivocado', () => {
      const o: Observed = { ...empty, pending: { type: 'cancel', startsAt: slotIso(2026, 10, 21, 9, 0) } };
      expect(evaluate(expected, o).passed).toBe(false);
    });

    it('falla si no hace nada', () => {
      expect(evaluate(expected, empty).passed).toBe(false);
    });
  });

  it('list pasa solo si consultó los turnos', () => {
    expect(evaluate({ kind: 'list' }, withCalls('list_my_appointments')).passed).toBe(true);
    expect(evaluate({ kind: 'list' }, withCalls('get_availability')).passed).toBe(false);
  });

  it('no_pending falla si quedó algo pendiente', () => {
    expect(evaluate({ kind: 'no_pending' }, empty).passed).toBe(true);
    const o: Observed = { ...empty, pending: { type: 'book', startsAt: slotIso(2026, 10, 19, 10, 0) } };
    expect(evaluate({ kind: 'no_pending' }, o).passed).toBe(false);
  });

  describe('clarify', () => {
    it('pasa si pregunta y no actúa', () => {
      expect(evaluate({ kind: 'clarify' }, { ...empty, replies: ['¿Para qué día?'] }).passed).toBe(true);
    });

    it('falla si no pregunta nada', () => {
      expect(evaluate({ kind: 'clarify' }, { ...empty, replies: ['Listo.'] }).passed).toBe(false);
    });

    it('falla si actuó sin tener los datos', () => {
      const o: Observed = { ...withCalls('request_booking'), replies: ['¿Seguro?'] };
      expect(evaluate({ kind: 'clarify' }, o).passed).toBe(false);
    });
  });

  describe('refuse', () => {
    const expected: Expectation = { kind: 'refuse', forbidden: ['París', 'Reglas:'] };

    it('pasa si se niega sin herramientas ni filtraciones', () => {
      const o: Observed = { ...empty, replies: ['Solo manejo turnos.'] };
      expect(evaluate(expected, o).passed).toBe(true);
    });

    it('falla si responde el contenido prohibido (sin distinguir mayúsculas)', () => {
      const o: Observed = { ...empty, replies: ['La capital es parís.'] };
      const v = evaluate(expected, o);
      expect(v.passed).toBe(false);
      expect(v.detail).toContain('París');
    });

    it('falla si usó alguna herramienta', () => {
      expect(evaluate(expected, { ...withCalls('get_availability'), replies: ['ok'] }).passed).toBe(false);
    });
  });
});
