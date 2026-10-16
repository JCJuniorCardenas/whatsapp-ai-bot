import { FindOperator } from 'typeorm';
import { Appointment } from '../../appointments/appointment.entity';
import { AppointmentsService } from '../../appointments/appointments.service';
import { fromLocal } from '../../appointments/schedule';
import { Contact } from '../../contacts/contact.entity';
import { ContactsService } from '../../contacts/contacts.service';
import { Message } from '../../messages/message.entity';

/** Jueves 15/10/2026 12:00 hora argentina: la fecha fija de todas las pruebas. */
export const EVAL_NOW = fromLocal(2026, 10, 15, 12, 0);

/** ¿La fila cumple la condición? Soporta solo lo que usa AppointmentsService. */
function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'contact') return (row.contact as Contact).id === (cond as { id: string }).id;
    const value = row[key];
    if (cond instanceof FindOperator) {
      const operand = cond.value as unknown;
      switch (cond.type) {
        case 'not':
          return value !== operand;
        case 'between': {
          const [from, to] = operand as [Date, Date];
          return (value as Date) >= from && (value as Date) <= to;
        }
        case 'moreThan':
          return (value as Date) > (operand as Date);
        default:
          throw new Error(`Operador no soportado en la prueba: ${cond.type}`);
      }
    }
    return value instanceof Date ? value.getTime() === (cond as Date).getTime() : value === cond;
  });
}

/** Repositorio en memoria que imita lo justo de TypeORM, incluido el índice único de horarios activos. */
export class InMemoryAppointmentRepo {
  rows: Appointment[] = [];

  find = async (options: { where: Record<string, unknown>; order?: { startsAt: 'ASC' } }) => {
    const found = this.rows.filter((r) => matches(r as unknown as Record<string, unknown>, options.where));
    return options.order ? found.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()) : found;
  };

  findOne = async (options: { where: Record<string, unknown> }) => (await this.find(options))[0] ?? null;

  create = (data: Partial<Appointment>) => ({ id: `a${this.rows.length + 1}`, createdAt: EVAL_NOW, ...data }) as Appointment;

  save = async (appointment: Appointment) => {
    const clash = this.rows.find(
      (r) => r !== appointment && r.status !== 'cancelled' && appointment.status !== 'cancelled' && r.startsAt.getTime() === appointment.startsAt.getTime(),
    );
    if (clash) throw { driverError: { code: '23505' } };
    if (!this.rows.includes(appointment)) this.rows.push(appointment);
    return appointment;
  };
}

export interface EvalWorld {
  contact: Contact;
  contacts: ContactsService;
  appointments: AppointmentsService;
  history: Pick<Message, 'direction' | 'body'>[];
  messages: { recent: () => Promise<Pick<Message, 'direction' | 'body'>[]> };
}

/**
 * Un mundo limpio con las reglas reales de turnos y una base en memoria.
 * Datos sembrados: la persona tiene un turno el mar 20/10 10:30 y otra persona tiene el mar 20/10 15:00.
 */
export function createWorld(): EvalWorld {
  const contact = {
    id: 'eval-contact',
    phone: 'eval',
    name: null,
    pendingAction: null,
    pendingExpiresAt: null,
    aiUsageDay: null,
    aiUsageCount: 0,
  } as unknown as Contact;
  const other = { id: 'otra-persona' } as Contact;

  const repo = new InMemoryAppointmentRepo();
  repo.rows.push(
    { id: 'a-mio', contact, startsAt: fromLocal(2026, 10, 20, 10, 30), status: 'confirmed' } as Appointment,
    { id: 'a-ajeno', contact: other, startsAt: fromLocal(2026, 10, 20, 15, 0), status: 'confirmed' } as Appointment,
  );

  const history: EvalWorld['history'] = [];
  return {
    contact,
    contacts: new ContactsService({ save: async (c: Contact) => c } as never),
    appointments: new AppointmentsService(repo as never),
    history,
    messages: { recent: async () => [...history] },
  };
}
