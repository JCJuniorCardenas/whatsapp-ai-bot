import { fromLocal } from '../appointments/schedule';
import { parseCommand, parseConfirmation, parseDay, parseTime } from './command.parser';

// Jueves 15/10/2026 12:00 hora argentina
const now = fromLocal(2026, 10, 15, 12, 0);

describe('parseTime', () => {
  it.each([
    ['10', { h: 10, min: 0 }],
    ['10:30', { h: 10, min: 30 }],
    ['10.30', { h: 10, min: 30 }],
    ['10hs', { h: 10, min: 0 }],
    ['9:00hs', { h: 9, min: 0 }],
  ])('entiende %s', (input, expected) => {
    expect(parseTime(input)).toEqual(expected);
  });

  it.each(['25:00', '10:75', 'abc', ''])('rechaza %s', (input) => {
    expect(parseTime(input)).toBeNull();
  });
});

describe('parseDay', () => {
  it('entiende hoy y mañana', () => {
    expect(parseDay('hoy', now)).toEqual({ y: 2026, m: 10, d: 15 });
    expect(parseDay('manana', now)).toEqual({ y: 2026, m: 10, d: 16 });
  });

  it('toma el año actual si la fecha todavía no pasó', () => {
    expect(parseDay('20/10', now)).toEqual({ y: 2026, m: 10, d: 20 });
  });

  it('salta al año siguiente si la fecha ya pasó', () => {
    expect(parseDay('10/03', now)).toEqual({ y: 2027, m: 3, d: 10 });
  });

  it('acepta año explícito y guion', () => {
    expect(parseDay('20-10-2026', now)).toEqual({ y: 2026, m: 10, d: 20 });
  });

  it('rechaza fechas que no existen', () => {
    expect(parseDay('31/02', now)).toBeNull();
    expect(parseDay('xx', now)).toBeNull();
  });
});

describe('parseCommand', () => {
  it('ayuda y saludos', () => {
    expect(parseCommand('Hola', now)).toEqual({ type: 'help' });
    expect(parseCommand('  AYUDA ', now)).toEqual({ type: 'help' });
  });

  it('disponibles, con y sin día', () => {
    expect(parseCommand('disponibles', now)).toEqual({ type: 'availability' });
    expect(parseCommand('Disponibles mañana', now)).toEqual({
      type: 'availability',
      day: { y: 2026, m: 10, d: 16 },
    });
    expect(parseCommand('disponibles basura', now)).toEqual({
      type: 'invalid',
      usage: 'disponibles 20/10',
    });
  });

  it('reservar un turno', () => {
    expect(parseCommand('turno 20/10 10:30', now)).toEqual({
      type: 'book',
      startsAt: fromLocal(2026, 10, 20, 10, 30),
    });
    expect(parseCommand('Reservar mañana 9', now)).toEqual({
      type: 'book',
      startsAt: fromLocal(2026, 10, 16, 9, 0),
    });
  });

  it('turno sin datos explica cómo usarlo', () => {
    expect(parseCommand('turno', now)).toEqual({ type: 'invalid', usage: 'turno 20/10 10:30' });
    expect(parseCommand('turno 20/10', now)).toEqual({ type: 'invalid', usage: 'turno 20/10 10:30' });
  });

  it('mis turnos no se confunde con disponibles', () => {
    expect(parseCommand('mis turnos', now)).toEqual({ type: 'list' });
    expect(parseCommand('turnos', now)).toEqual({ type: 'availability' });
  });

  it('cancelar', () => {
    expect(parseCommand('cancelar 20/10 10:30', now)).toEqual({
      type: 'cancel',
      startsAt: fromLocal(2026, 10, 20, 10, 30),
    });
    expect(parseCommand('cancelar', now)).toEqual({ type: 'invalid', usage: 'cancelar 20/10 10:30' });
  });

  it('lo que no entiende es unknown', () => {
    expect(parseCommand('quiero pizza', now)).toEqual({ type: 'unknown' });
    expect(parseCommand('', now)).toEqual({ type: 'unknown' });
  });
});

describe('parseConfirmation', () => {
  it.each(['sí', 'Si', 'SÍ!', 'dale', 'ok', 'Confirmo', 'de una', 'si confirmo'])('%s es sí', (t) => {
    expect(parseConfirmation(t)).toBe('yes');
  });

  it.each(['no', 'No.', 'mejor no', 'no gracias'])('%s es no', (t) => {
    expect(parseConfirmation(t)).toBe('no');
  });

  it.each(['si pero a las 4', 'no sé', 'turno 20/10 10:30', 'quizás', ''])('%s no es ni sí ni no', (t) => {
    expect(parseConfirmation(t)).toBeNull();
  });
});
