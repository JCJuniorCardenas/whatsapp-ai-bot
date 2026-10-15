import {
  addDays,
  fromLocal,
  LocalDate,
  todayLocal,
  validLocalDate,
} from '../appointments/schedule';

export type Command =
  | { type: 'help' }
  | { type: 'availability'; day?: LocalDate }
  | { type: 'book'; startsAt: Date }
  | { type: 'list' }
  | { type: 'cancel'; startsAt: Date }
  | { type: 'invalid'; usage: string }
  | { type: 'unknown' };

const HELP_WORDS = ['ayuda', 'hola', 'menu', 'help', 'comandos', 'buenas', 'buen'];
const AVAILABILITY_WORDS = ['disponibles', 'disponible', 'disponibilidad', 'horarios', 'turnos'];
const BOOK_WORDS = ['turno', 'reservar', 'agendar'];
const CANCEL_WORDS = ['cancelar', 'anular'];

/** Minúsculas, sin tildes y con los espacios normalizados. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "hoy", "manana", "20/10" o "20/10/2026". Sin año, toma el próximo 20/10 que no haya pasado. */
export function parseDay(token: string, now: Date): LocalDate | null {
  const today = todayLocal(now);
  if (token === 'hoy') return today;
  if (token === 'manana') return addDays(today, 1);

  const match = token.match(/^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/);
  if (!match) return null;
  const d = Number(match[1]);
  const m = Number(match[2]);
  if (match[3]) return validLocalDate(Number(match[3]), m, d);

  const thisYear = validLocalDate(today.y, m, d);
  if (!thisYear) return null;
  const isPast = fromLocal(thisYear.y, thisYear.m, thisYear.d, 23, 59) < now;
  return isPast ? validLocalDate(today.y + 1, m, d) : thisYear;
}

/** "10", "10:30", "10.30", "10hs" o "10:30hs". */
export function parseTime(token: string): { h: number; min: number } | null {
  const match = token.replace(/hs?$/, '').match(/^(\d{1,2})(?:[:.](\d{2}))?$/);
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2] ?? 0);
  return h < 24 && min < 60 ? { h, min } : null;
}

function parseDayAndTime(args: string[], now: Date): Date | null {
  if (args.length !== 2) return null;
  const day = parseDay(args[0], now);
  const time = parseTime(args[1]);
  if (!day || !time) return null;
  return fromLocal(day.y, day.m, day.d, time.h, time.min);
}

const YES = ['si', 'sii', 'siii', 'sip', 'dale', 'ok', 'okey', 'oka', 'confirmo', 'confirmar', 'listo', 'joya', 'de una', 'si confirmo', 'si dale'];
const NO = ['no', 'nop', 'nope', 'no gracias', 'mejor no', 'no confirmo'];

/** "sí" o "no" a una pregunta de confirmación. Solo mensajes cortos y exactos: ante la duda, null. */
export function parseConfirmation(text: string): 'yes' | 'no' | null {
  const clean = normalize(text).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  if (YES.includes(clean)) return 'yes';
  if (NO.includes(clean)) return 'no';
  return null;
}

export function parseCommand(text: string, now = new Date()): Command {
  const [word, ...args] = normalize(text).split(' ');

  if (word === 'mis' && args[0]?.startsWith('turno')) return { type: 'list' };
  if (HELP_WORDS.includes(word)) return { type: 'help' };

  if (AVAILABILITY_WORDS.includes(word)) {
    if (args.length === 0) return { type: 'availability' };
    const day = parseDay(args[0], now);
    return day
      ? { type: 'availability', day }
      : { type: 'invalid', usage: 'disponibles 20/10' };
  }

  if (BOOK_WORDS.includes(word)) {
    const startsAt = parseDayAndTime(args, now);
    return startsAt
      ? { type: 'book', startsAt }
      : { type: 'invalid', usage: 'turno 20/10 10:30' };
  }

  if (CANCEL_WORDS.includes(word)) {
    const startsAt = parseDayAndTime(args, now);
    return startsAt
      ? { type: 'cancel', startsAt }
      : { type: 'invalid', usage: 'cancelar 20/10 10:30' };
  }

  return { type: 'unknown' };
}
