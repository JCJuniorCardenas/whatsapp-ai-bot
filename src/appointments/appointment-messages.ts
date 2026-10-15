import { AppointmentError } from './appointments.service';
import { CLOSE_HOUR, MAX_DAYS_AHEAD, OPEN_HOUR } from './schedule';

/** Qué se le dice a la persona cuando una operación de turnos falla. */
export const APPOINTMENT_ERROR_MESSAGES: Record<AppointmentError['code'], string> = {
  PAST: 'Ese horario ya pasó. Mirá los libres con *disponibles*.',
  TOO_FAR: `Solo se pueden reservar turnos hasta ${MAX_DAYS_AHEAD} días adelante.`,
  OUTSIDE_HOURS: `Ese horario no es válido. Atendemos de lunes a viernes, de ${OPEN_HOUR}:00 a ${CLOSE_HOUR}:00, cada 30 minutos. Mirá los libres con *disponibles*.`,
  TAKEN: '😕 Ese horario ya fue tomado. Mirá otros con *disponibles*.',
  NOT_FOUND: 'No encontré un turno tuyo en ese horario. Mirá los tuyos con *mis turnos*.',
};
