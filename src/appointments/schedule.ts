// Horario de atención y manejo de fechas en hora de Argentina (UTC-3, sin horario de verano).
// Se hace a mano para no sumar una librería de fechas por esto.

export const UTC_OFFSET_HOURS = -3;

export interface ScheduleConfig {
  openMinutes: number; // minutos desde medianoche: 9:00 = 540
  closeMinutes: number; // el último turno termina a esta hora
  slotMinutes: number;
  workDays: number[]; // 0 = domingo ... 6 = sábado
  maxDaysAhead: number;
}

const DAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function parseClock(value: string, name: string): number {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match || Number(match[1]) > 24 || Number(match[2]) > 59) {
    throw new Error(`${name} inválida ("${value}"): usá el formato HH:MM, por ejemplo 09:00`);
  }
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "1-5", "1,3,5" o "1-3,5" (0 = domingo ... 6 = sábado). */
function parseDays(value: string): number[] {
  const days = new Set<number>();
  for (const part of value.split(',')) {
    const range = part.trim().match(/^([0-6])(?:-([0-6]))?$/);
    if (!range) {
      throw new Error(`SCHEDULE_DAYS inválida ("${value}"): usá números del 0 (domingo) al 6, por ejemplo 1-5`);
    }
    const from = Number(range[1]);
    const to = Number(range[2] ?? range[1]);
    if (to < from) throw new Error(`SCHEDULE_DAYS inválida ("${value}"): el rango ${part} está al revés`);
    for (let d = from; d <= to; d++) days.add(d);
  }
  return [...days].sort((a, b) => a - b);
}

/** Lee y valida el horario desde variables de entorno. Falla con un mensaje claro si algo no cierra. */
export function parseScheduleConfig(env: Record<string, string | undefined>): ScheduleConfig {
  const openMinutes = parseClock(env.SCHEDULE_OPEN || '09:00', 'SCHEDULE_OPEN');
  const closeMinutes = parseClock(env.SCHEDULE_CLOSE || '18:00', 'SCHEDULE_CLOSE');
  const slotMinutes = Number(env.SCHEDULE_SLOT_MINUTES || 30);
  const maxDaysAhead = Number(env.SCHEDULE_MAX_DAYS_AHEAD || 60);
  const workDays = parseDays(env.SCHEDULE_DAYS || '1-5');

  if (!Number.isInteger(slotMinutes) || slotMinutes < 5 || slotMinutes > 240) {
    throw new Error(`SCHEDULE_SLOT_MINUTES inválida ("${env.SCHEDULE_SLOT_MINUTES}"): un número entre 5 y 240`);
  }
  if (!Number.isInteger(maxDaysAhead) || maxDaysAhead < 1 || maxDaysAhead > 365) {
    throw new Error(`SCHEDULE_MAX_DAYS_AHEAD inválida ("${env.SCHEDULE_MAX_DAYS_AHEAD}"): un número entre 1 y 365`);
  }
  if (closeMinutes - openMinutes < slotMinutes) {
    throw new Error('El horario de cierre tiene que dejar lugar para al menos un turno después de la apertura');
  }
  return { openMinutes, closeMinutes, slotMinutes, workDays, maxDaysAhead };
}

/** Horario vigente. Se lee de las variables de entorno en cada uso, así siempre está al día. */
export function getScheduleConfig(): ScheduleConfig {
  return parseScheduleConfig(process.env);
}

function clock(minutes: number): string {
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}

/** "de lunes a viernes" o "lunes, miércoles y viernes". */
export function describeDays(workDays: number[]): string {
  const consecutive = workDays.every((d, i) => i === 0 || d === workDays[i - 1] + 1);
  if (workDays.length >= 3 && consecutive) {
    return `de ${DAY_LABELS[workDays[0]]} a ${DAY_LABELS[workDays[workDays.length - 1]]}`;
  }
  const names = workDays.map((d) => DAY_LABELS[d]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** Ej. "de lunes a viernes, de 9:00 a 18:00, con turnos de 30 minutos". */
export function describeSchedule(config = getScheduleConfig()): string {
  return `${describeDays(config.workDays)}, de ${clock(config.openMinutes)} a ${clock(config.closeMinutes)}, con turnos de ${config.slotMinutes} minutos`;
}

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
export function slotsOfDay(day: LocalDate, config = getScheduleConfig()): Date[] {
  const { dow } = toLocalParts(fromLocal(day.y, day.m, day.d, 12));
  if (!config.workDays.includes(dow)) return [];
  const slots: Date[] = [];
  for (let t = config.openMinutes; t + config.slotMinutes <= config.closeMinutes; t += config.slotMinutes) {
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
