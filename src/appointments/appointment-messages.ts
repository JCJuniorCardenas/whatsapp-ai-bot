import { AppointmentError } from './appointments.service';
import { describeSchedule, getScheduleConfig } from './schedule';

/** Qué se le dice a la persona cuando una operación de turnos falla. */
export function appointmentErrorMessage(code: AppointmentError['code']): string {
  switch (code) {
    case 'PAST':
      return 'Ese horario ya pasó. Mirá los libres con *disponibles*.';
    case 'TOO_FAR':
      return `Solo se pueden reservar turnos hasta ${getScheduleConfig().maxDaysAhead} días adelante.`;
    case 'OUTSIDE_HOURS':
      return `Ese horario no es válido. Atendemos ${describeSchedule()}. Mirá los libres con *disponibles*.`;
    case 'TAKEN':
      return '😕 Ese horario ya fue tomado. Mirá otros con *disponibles*.';
    case 'NOT_FOUND':
      return 'No encontré un turno tuyo en ese horario. Mirá los tuyos con *mis turnos*.';
  }
}
