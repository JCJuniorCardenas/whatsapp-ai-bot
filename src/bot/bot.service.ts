import { Injectable } from '@nestjs/common';
import { AppointmentError, AppointmentsService } from '../appointments/appointments.service';
import {
  CLOSE_HOUR,
  formatDay,
  formatSlot,
  formatTime,
  LocalDate,
  MAX_DAYS_AHEAD,
  OPEN_HOUR,
  slotsOfDay,
  toLocalParts,
} from '../appointments/schedule';
import { Contact } from '../contacts/contact.entity';
import { Command, parseCommand } from './command.parser';

const HELP = [
  'Hola 👋 Soy el bot de turnos.',
  `Atendemos de lunes a viernes de ${OPEN_HOUR}:00 a ${CLOSE_HOUR}:00, turnos de 30 minutos.`,
  '',
  '• *disponibles*: ver los próximos horarios libres',
  '• *disponibles 20/10*: horarios libres de un día',
  '• *turno 20/10 10:30*: reservar',
  '• *mis turnos*: ver tus turnos',
  '• *cancelar 20/10 10:30*: cancelar un turno',
].join('\n');

const COMMAND_HINT = 'Escribí *ayuda* para ver qué puedo hacer.';

const ERROR_MESSAGES: Record<AppointmentError['code'], string> = {
  PAST: 'Ese horario ya pasó. Mirá los libres con *disponibles*.',
  TOO_FAR: `Solo se pueden reservar turnos hasta ${MAX_DAYS_AHEAD} días adelante.`,
  OUTSIDE_HOURS: `Ese horario no es válido. Atendemos de lunes a viernes, de ${OPEN_HOUR}:00 a ${CLOSE_HOUR}:00, cada 30 minutos. Mirá los libres con *disponibles*.`,
  TAKEN: '😕 Ese horario ya fue tomado. Mirá otros con *disponibles*.',
  NOT_FOUND: 'No encontré un turno tuyo en ese horario. Mirá los tuyos con *mis turnos*.',
};

@Injectable()
export class BotService {
  constructor(private readonly appointments: AppointmentsService) {}

  /** Devuelve el texto con el que hay que responderle a esa persona. */
  async reply(contact: Contact, text: string, now = new Date()): Promise<string> {
    const command = parseCommand(text, now);
    try {
      return await this.run(contact, command, now);
    } catch (err) {
      if (err instanceof AppointmentError) return ERROR_MESSAGES[err.code];
      throw err;
    }
  }

  private async run(contact: Contact, command: Command, now: Date): Promise<string> {
    switch (command.type) {
      case 'help':
        return HELP;
      case 'availability':
        return command.day
          ? this.availabilityOfDay(command.day, now)
          : this.nextAvailability(now);
      case 'book': {
        const appt = await this.appointments.book(contact, command.startsAt, now);
        const when = formatSlot(appt.startsAt);
        return `✅ Listo, tu turno quedó reservado para el ${when}.\nSi no podés ir, cancelalo con *cancelar ${shortCommand(appt.startsAt)}*.`;
      }
      case 'list':
        return this.myAppointments(contact, now);
      case 'cancel': {
        const appt = await this.appointments.cancel(contact, command.startsAt, now);
        return `Listo, cancelé tu turno del ${formatSlot(appt.startsAt)}.`;
      }
      case 'invalid':
        return `Me faltó algún dato. Probá así: *${command.usage}*`;
      default:
        return `No entendí 🤔 ${COMMAND_HINT}`;
    }
  }

  private async nextAvailability(now: Date): Promise<string> {
    const days = await this.appointments.nextAvailability(now);
    if (days.length === 0) return 'No hay turnos libres en los próximos días.';
    const lines = days.map(
      ({ day, slots }) => `*${formatDay(day)}*: ${slots.map(formatTime).join(', ')}`,
    );
    return `Próximos horarios libres:\n\n${lines.join('\n')}\n\nPara reservar: *turno 20/10 10:30*`;
  }

  private async availabilityOfDay(day: LocalDate, now: Date): Promise<string> {
    if (slotsOfDay(day).length === 0) {
      return `El ${formatDay(day)} no atendemos. Atendemos de lunes a viernes.`;
    }
    const slots = await this.appointments.freeSlots(day, now);
    if (slots.length === 0) return `No quedan turnos libres el ${formatDay(day)}.`;
    return `Libres el ${formatDay(day)}:\n${slots.map(formatTime).join(', ')}`;
  }

  private async myAppointments(contact: Contact, now: Date): Promise<string> {
    const list = await this.appointments.upcoming(contact, now);
    if (list.length === 0) {
      return 'No tenés turnos reservados. Mirá horarios con *disponibles*.';
    }
    return `Tus turnos:\n${list.map((a) => `• ${formatSlot(a.startsAt)}`).join('\n')}`;
  }
}

/** "20/10 10:30": cómo se escribe ese horario en un comando. */
function shortCommand(date: Date): string {
  const p = toLocalParts(date);
  const two = (n: number) => String(n).padStart(2, '0');
  return `${two(p.d)}/${two(p.m)} ${p.h}:${two(p.min)}`;
}
