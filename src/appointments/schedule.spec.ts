import {
  addDays,
  formatSlot,
  fromLocal,
  isValidSlot,
  slotsOfDay,
  toLocalParts,
  validLocalDate,
} from './schedule';

describe('schedule', () => {
  it('convierte entre hora argentina y UTC', () => {
    // 10:30 en Argentina = 13:30 UTC
    expect(fromLocal(2026, 10, 20, 10, 30).toISOString()).toBe('2026-10-20T13:30:00.000Z');
    expect(toLocalParts(new Date('2026-10-20T13:30:00Z'))).toMatchObject({ d: 20, h: 10, min: 30 });
  });

  it('resuelve bien el cambio de día (madrugada UTC = noche anterior en Argentina)', () => {
    expect(toLocalParts(new Date('2026-10-21T01:00:00Z'))).toMatchObject({ d: 20, h: 22 });
  });

  it('rechaza fechas inexistentes', () => {
    expect(validLocalDate(2026, 2, 31)).toBeNull();
    expect(validLocalDate(2026, 10, 20)).toEqual({ y: 2026, m: 10, d: 20 });
  });

  it('suma días cruzando el fin de mes', () => {
    expect(addDays({ y: 2026, m: 10, d: 30 }, 3)).toEqual({ y: 2026, m: 11, d: 2 });
  });

  it('un día hábil tiene 18 turnos de 9:00 a 17:30', () => {
    const slots = slotsOfDay({ y: 2026, m: 10, d: 20 }); // martes
    expect(slots).toHaveLength(18);
    expect(formatSlot(slots[0])).toBe('mar 20/10 9:00');
    expect(formatSlot(slots[17])).toBe('mar 20/10 17:30');
  });

  it('no hay turnos sábado ni domingo', () => {
    expect(slotsOfDay({ y: 2026, m: 10, d: 24 })).toEqual([]); // sábado
    expect(slotsOfDay({ y: 2026, m: 10, d: 25 })).toEqual([]); // domingo
  });

  it('valida que el horario sea un turno real', () => {
    expect(isValidSlot(fromLocal(2026, 10, 20, 10, 30))).toBe(true);
    expect(isValidSlot(fromLocal(2026, 10, 20, 10, 15))).toBe(false); // no es múltiplo de 30
    expect(isValidSlot(fromLocal(2026, 10, 20, 18, 0))).toBe(false); // ya cerró
    expect(isValidSlot(fromLocal(2026, 10, 24, 10, 0))).toBe(false); // sábado
  });
});
