import { fromLocal } from '../../appointments/schedule';
import { createWorld, EVAL_NOW } from './eval-world';

describe('mundo simulado de las pruebas de la IA', () => {
  it('usa las reglas reales: el horario de otra persona figura ocupado', async () => {
    const { appointments } = createWorld();
    await expect(appointments.assertBookable(fromLocal(2026, 10, 20, 15, 0), EVAL_NOW)).rejects.toMatchObject({
      code: 'TAKEN',
    });
    await expect(appointments.assertBookable(fromLocal(2026, 10, 20, 11, 0), EVAL_NOW)).resolves.toBeUndefined();
  });

  it('la disponibilidad descarta lo ocupado y lo que ya pasó', async () => {
    const { appointments } = createWorld();
    const martes = await appointments.freeSlots({ y: 2026, m: 10, d: 20 }, EVAL_NOW);
    expect(martes).toHaveLength(16); // 18 turnos menos el propio (10:30) y el ajeno (15:00)
    const hoy = await appointments.freeSlots({ y: 2026, m: 10, d: 15 }, EVAL_NOW);
    expect(hoy[0]).toEqual(fromLocal(2026, 10, 15, 12, 30));
  });

  it('lista solo los turnos de la persona', async () => {
    const { appointments, contact } = createWorld();
    const mios = await appointments.upcoming(contact, EVAL_NOW);
    expect(mios.map((a) => a.id)).toEqual(['a-mio']);
  });

  it('solo se puede cancelar un turno propio', async () => {
    const { appointments, contact } = createWorld();
    await expect(appointments.assertCancellable(contact, fromLocal(2026, 10, 20, 10, 30), EVAL_NOW)).resolves.toBeUndefined();
    await expect(appointments.assertCancellable(contact, fromLocal(2026, 10, 20, 15, 0), EVAL_NOW)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('reservar un horario ya tomado falla por el índice único simulado', async () => {
    const { appointments, contact } = createWorld();
    await expect(appointments.book(contact, fromLocal(2026, 10, 20, 15, 0), EVAL_NOW)).rejects.toMatchObject({
      code: 'TAKEN',
    });
    await expect(appointments.book(contact, fromLocal(2026, 10, 20, 11, 0), EVAL_NOW)).resolves.toMatchObject({
      status: 'confirmed',
    });
  });
});
