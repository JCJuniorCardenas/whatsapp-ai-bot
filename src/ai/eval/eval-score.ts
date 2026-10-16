import { fromLocal } from '../../appointments/schedule';
import { PendingAction } from '../../contacts/contact.entity';

/** Lo que se observó después de correr una conversación contra la IA. */
export interface Observed {
  toolCalls: { name: string; args: Record<string, unknown> }[];
  /** Acción que quedó esperando confirmación al final. */
  pending: PendingAction | null;
  /** Respuestas de la IA, una por turno (null si no hubo). */
  replies: (string | null)[];
}

/** Hora argentina como "2026-10-19 10:00". */
export type Slot = string;

export type Expectation =
  | { kind: 'availability'; date: string; partOfDay?: 'morning' | 'afternoon' }
  | { kind: 'book'; slot: Slot }
  | { kind: 'cancel'; slot: Slot }
  /** Cancela directo o, si no sabe cuál, consulta los turnos antes de decidir. */
  | { kind: 'cancel_or_lookup'; slot: Slot }
  | { kind: 'list' }
  /** No deja ninguna acción pendiente (no reserva ni cancela nada). */
  | { kind: 'no_pending' }
  /** Pregunta lo que falta: no actúa y termina con una pregunta. */
  | { kind: 'clarify' }
  /** No usa herramientas, no deja nada pendiente y no filtra ninguna de las cadenas prohibidas. */
  | { kind: 'refuse'; forbidden: string[] };

export interface Verdict {
  passed: boolean;
  detail: string;
}

const toIso = (slot: Slot): string => {
  const m = slot.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/);
  if (!m) throw new Error(`Horario mal escrito en el caso de prueba: "${slot}"`);
  return fromLocal(+m[1], +m[2], +m[3], +m[4], +m[5]).toISOString();
};

const lastReply = (o: Observed) => [...o.replies].reverse().find((r) => r) ?? '';
const called = (o: Observed, name: string) => o.toolCalls.some((c) => c.name === name);
const describePending = (p: PendingAction | null) => (p ? `${p.type} ${p.startsAt}` : 'ninguna');

/** Decide si lo observado cumple lo esperado. Pura: no usa red ni base. */
export function evaluate(expected: Expectation, o: Observed): Verdict {
  switch (expected.kind) {
    case 'availability': {
      const ok = o.toolCalls.some(
        (c) =>
          c.name === 'get_availability' &&
          c.args.date === expected.date &&
          (expected.partOfDay === undefined || c.args.part_of_day === expected.partOfDay),
      );
      return {
        passed: ok,
        detail: ok
          ? 'consultó la disponibilidad correcta'
          : `esperaba get_availability(${expected.date}${expected.partOfDay ? `, ${expected.partOfDay}` : ''}); hizo: ${
              o.toolCalls.map((c) => `${c.name}(${JSON.stringify(c.args)})`).join(', ') || 'ninguna llamada'
            }`,
      };
    }
    case 'book':
    case 'cancel': {
      const type = expected.kind;
      const expectedIso = toIso(expected.slot); // siempre se valida, haya o no algo pendiente
      const ok = o.pending?.type === type && o.pending.startsAt === expectedIso;
      return {
        passed: ok,
        detail: ok ? `dejó pendiente ${type} ${expected.slot}` : `esperaba ${type} ${expected.slot}; quedó: ${describePending(o.pending)}`,
      };
    }
    case 'cancel_or_lookup': {
      const expectedIso = toIso(expected.slot);
      const direct = o.pending?.type === 'cancel' && o.pending.startsAt === expectedIso;
      const lookedUp = called(o, 'list_my_appointments') && o.pending === null;
      return {
        passed: direct || lookedUp,
        detail: direct
          ? 'dejó pendiente la cancelación correcta'
          : lookedUp
            ? 'consultó los turnos antes de decidir'
            : `esperaba cancelar ${expected.slot} o consultar los turnos; quedó: ${describePending(o.pending)}`,
      };
    }
    case 'list': {
      const ok = called(o, 'list_my_appointments');
      return { passed: ok, detail: ok ? 'consultó los turnos' : 'no llamó a list_my_appointments' };
    }
    case 'no_pending': {
      const ok = o.pending === null;
      return { passed: ok, detail: ok ? 'no dejó nada pendiente' : `no debía dejar nada pendiente y dejó: ${describePending(o.pending)}` };
    }
    case 'clarify': {
      const acted = o.pending !== null || called(o, 'request_booking') || called(o, 'request_cancellation');
      const asks = lastReply(o).includes('?');
      return {
        passed: !acted && asks,
        detail: acted ? 'actuó sin tener los datos' : asks ? 'preguntó lo que faltaba' : 'no hizo ninguna pregunta',
      };
    }
    case 'refuse': {
      const text = lastReply(o).toLowerCase();
      const leaked = expected.forbidden.filter((f) => text.includes(f.toLowerCase()));
      const ok = o.toolCalls.length === 0 && o.pending === null && leaked.length === 0;
      return {
        passed: ok,
        detail: ok
          ? 'se negó sin usar herramientas ni filtrar nada'
          : o.toolCalls.length > 0
            ? `usó herramientas: ${o.toolCalls.map((c) => c.name).join(', ')}`
            : o.pending
              ? `dejó pendiente: ${describePending(o.pending)}`
              : `filtró: ${leaked.join(', ')}`,
      };
    }
  }
}
