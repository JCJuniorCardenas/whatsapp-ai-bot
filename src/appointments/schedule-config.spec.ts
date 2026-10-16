import {
  describeDays,
  describeSchedule,
  fromLocal,
  isValidSlot,
  parseScheduleConfig,
  slotsOfDay,
} from './schedule';

describe('parseScheduleConfig', () => {
  it('sin variables usa el horario por defecto: lun a vie, 9 a 18, cada 30 min', () => {
    expect(parseScheduleConfig({})).toEqual({
      openMinutes: 540,
      closeMinutes: 1080,
      slotMinutes: 30,
      workDays: [1, 2, 3, 4, 5],
      maxDaysAhead: 60,
    });
  });

  it('lee un horario personalizado', () => {
    const c = parseScheduleConfig({
      SCHEDULE_OPEN: '08:30',
      SCHEDULE_CLOSE: '20:00',
      SCHEDULE_SLOT_MINUTES: '45',
      SCHEDULE_DAYS: '1-3,6',
      SCHEDULE_MAX_DAYS_AHEAD: '30',
    });
    expect(c).toEqual({
      openMinutes: 510,
      closeMinutes: 1200,
      slotMinutes: 45,
      workDays: [1, 2, 3, 6],
      maxDaysAhead: 30,
    });
  });

  it.each([
    [{ SCHEDULE_OPEN: '9' }, 'SCHEDULE_OPEN'],
    [{ SCHEDULE_CLOSE: '25:00' }, 'SCHEDULE_CLOSE'],
    [{ SCHEDULE_SLOT_MINUTES: '0' }, 'SCHEDULE_SLOT_MINUTES'],
    [{ SCHEDULE_SLOT_MINUTES: 'abc' }, 'SCHEDULE_SLOT_MINUTES'],
    [{ SCHEDULE_DAYS: '1-9' }, 'SCHEDULE_DAYS'],
    [{ SCHEDULE_DAYS: '5-1' }, 'SCHEDULE_DAYS'],
    [{ SCHEDULE_MAX_DAYS_AHEAD: '1000' }, 'SCHEDULE_MAX_DAYS_AHEAD'],
  ])('rechaza %j mencionando la variable', (env, variable) => {
    expect(() => parseScheduleConfig(env)).toThrow(variable);
  });

  it('rechaza un cierre que no deja lugar ni a un turno', () => {
    expect(() => parseScheduleConfig({ SCHEDULE_OPEN: '10:00', SCHEDULE_CLOSE: '10:20' })).toThrow(
      'al menos un turno',
    );
  });
});

describe('horario personalizado en acción', () => {
  const config = parseScheduleConfig({
    SCHEDULE_OPEN: '10:00',
    SCHEDULE_CLOSE: '12:00',
    SCHEDULE_SLOT_MINUTES: '40',
    SCHEDULE_DAYS: '6', // solo sábados
  });
  const saturday = { y: 2026, m: 10, d: 24 };

  it('genera solo los turnos que entran', () => {
    // 10:00, 10:40, 11:20 (el de 12:00 ya no entra)
    expect(slotsOfDay(saturday, config)).toHaveLength(3);
  });

  it('no atiende los días que no están configurados', () => {
    expect(slotsOfDay({ y: 2026, m: 10, d: 20 }, config)).toEqual([]); // martes
  });

  it('isValidSlot usa el horario vigente (variables de entorno)', () => {
    const original = { ...process.env };
    Object.assign(process.env, {
      SCHEDULE_OPEN: '10:00',
      SCHEDULE_CLOSE: '12:00',
      SCHEDULE_SLOT_MINUTES: '40',
      SCHEDULE_DAYS: '6',
    });
    try {
      expect(isValidSlot(fromLocal(2026, 10, 24, 10, 40))).toBe(true);
      expect(isValidSlot(fromLocal(2026, 10, 24, 10, 30))).toBe(false);
      expect(isValidSlot(fromLocal(2026, 10, 20, 10, 0))).toBe(false); // martes
    } finally {
      for (const key of ['SCHEDULE_OPEN', 'SCHEDULE_CLOSE', 'SCHEDULE_SLOT_MINUTES', 'SCHEDULE_DAYS']) {
        if (original[key] === undefined) delete process.env[key];
        else process.env[key] = original[key];
      }
    }
  });
});

describe('descripciones del horario', () => {
  it('rango de días corridos', () => {
    expect(describeDays([1, 2, 3, 4, 5])).toBe('de lunes a viernes');
  });

  it('días sueltos', () => {
    expect(describeDays([1, 3, 5])).toBe('lunes, miércoles y viernes');
    expect(describeDays([6])).toBe('sábado');
  });

  it('describe el horario completo', () => {
    expect(describeSchedule(parseScheduleConfig({}))).toBe(
      'de lunes a viernes, de 9:00 a 18:00, con turnos de 30 minutos',
    );
    expect(
      describeSchedule(parseScheduleConfig({ SCHEDULE_OPEN: '08:30', SCHEDULE_DAYS: '2,4' })),
    ).toBe('martes y jueves, de 8:30 a 18:00, con turnos de 30 minutos');
  });
});
