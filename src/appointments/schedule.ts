// Horario de atención y manejo de fechas en hora de Argentina (UTC-3, sin horario de verano).
// Se hace a mano para no sumar una librería de fechas por esto.

export const UTC_OFFSET_HOURS = -3;
export const SLOT_MINUTES = 30;
export const OPEN_HOUR = 9; // primer turno 9:00
export const CLOSE_HOUR = 18; // el último turno termina 18:00
export const WORK_DAYS = [1, 2, 3, 4, 5]; // lunes a viernes (0 = domingo)
export const MAX_DAYS_AHEAD = 60;

export interface LocalDate {
  y: number;
  m: number;
  d: number;
}

const DAY_NAMES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const HOUR_MS = 3_600_000;

/** Fecha y hora "de pared" argentina de un instante. */
export function toLocalParts(date: Date) {
  const s = new Date(date.getTime() + UTC_OFFSET_HOURS * HOUR_MS);
  return {
    y: s.getUTCFullYear(),
    m: s.getUTCMonth() + 1,
    d: s.getUTCDate(),
    h: s.getUTCHours(),
    min: s.getUTCMinutes(),
    dow: s.getUTCDay(),
  };
}

/** Instante que corresponde a una fecha y hora de pared argentina. */
export function fromLocal(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(Date.UTC(y, m - 1, d, h - UTC_OFFSET_HOURS, min));
}

/** Devuelve la fecha si existe en el calendario (ej. rechaza 31/02), o null. */
export function validLocalDate(y: number, m: number, d: number): LocalDate | null {
  const p = toLocalParts(fromLocal(y, m, d, 12));
  return p.y === y && p.m === m && p.d === d ? { y, m, d } : null;
}

export function todayLocal(now: Date): LocalDate {
  const { y, m, d } = toLocalParts(now);
  return { y, m, d };
}

export function addDays(day: LocalDate, n: number): LocalDate {
  const { y, m, d } = toLocalParts(fromLocal(day.y, day.m, day.d + n, 12));
  return { y, m, d };
}

/** Todos los turnos posibles de un día (vacío si no se atiende ese día). */
export function slotsOfDay(day: LocalDate): Date[] {
  const { dow } = toLocalParts(fromLocal(day.y, day.m, day.d, 12));
  if (!WORK_DAYS.includes(dow)) return [];
  const slots: Date[] = [];
  for (let t = OPEN_HOUR * 60; t + SLOT_MINUTES <= CLOSE_HOUR * 60; t += SLOT_MINUTES) {
    slots.push(fromLocal(day.y, day.m, day.d, Math.floor(t / 60), t % 60));
  }
  return slots;
}

export function isValidSlot(date: Date): boolean {
  const p = toLocalParts(date);
  return slotsOfDay({ y: p.y, m: p.m, d: p.d }).some((s) => s.getTime() === date.getTime());
}

const two = (n: number) => String(n).padStart(2, '0');

export function formatTime(date: Date): string {
  const p = toLocalParts(date);
  return `${p.h}:${two(p.min)}`;
}

export function formatDay(day: LocalDate): string {
  const { dow } = toLocalParts(fromLocal(day.y, day.m, day.d, 12));
  return `${DAY_NAMES[dow]} ${two(day.d)}/${two(day.m)}`;
}

/** Ej. "mar 20/10 10:30". */
export function formatSlot(date: Date): string {
  const p = toLocalParts(date);
  return `${formatDay(p)} ${formatTime(date)}`;
}
