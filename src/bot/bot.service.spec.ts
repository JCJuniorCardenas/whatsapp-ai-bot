import { Test } from '@nestjs/testing';
import { AiService } from '../ai/ai.service';
import { AppointmentError, AppointmentsService } from '../appointments/appointments.service';
import { fromLocal } from '../appointments/schedule';
import { Contact } from '../contacts/contact.entity';
import { ContactsService } from '../contacts/contacts.service';
import { BotService } from './bot.service';

describe('BotService', () => {
  let bot: BotService;
  const appointments = {
    nextAvailability: jest.fn(),
    freeSlots: jest.fn(),
    book: jest.fn(),
    upcoming: jest.fn(),
    cancel: jest.fn(),
  };
  const contacts = { getPending: jest.fn(), clearPending: jest.fn() };
  const ai = { reply: jest.fn() };
  const contact = { id: 'c1' } as Contact;
  // Jueves 15/10/2026 12:00 hora argentina
  const now = fromLocal(2026, 10, 15, 12, 0);
  const slot = fromLocal(2026, 10, 20, 10, 30);

  beforeEach(async () => {
    jest.clearAllMocks();
    contacts.getPending.mockReturnValue(null);
    ai.reply.mockResolvedValue(null);
    const moduleRef = await Test.createTestingModule({
      providers: [
        BotService,
        { provide: AppointmentsService, useValue: appointments },
        { provide: ContactsService, useValue: contacts },
        { provide: AiService, useValue: ai },
      ],
    }).compile();
    bot = moduleRef.get(BotService);
  });

  it('muestra la ayuda', async () => {
    expect(await bot.reply(contact, 'hola', now)).toContain('*turno 20/10 10:30*');
  });

  it('lista los próximos horarios libres', async () => {
    appointments.nextAvailability.mockResolvedValue([
      { day: { y: 2026, m: 10, d: 20 }, slots: [fromLocal(2026, 10, 20, 9, 0), slot] },
    ]);
    const text = await bot.reply(contact, 'disponibles', now);
    expect(text).toContain('*mar 20/10*: 9:00, 10:30');
  });

  it('avisa si no hay turnos', async () => {
    appointments.nextAvailability.mockResolvedValue([]);
    expect(await bot.reply(contact, 'disponibles', now)).toContain('No hay turnos libres');
  });

  it('dice que el fin de semana no se atiende, sin consultar la base', async () => {
    const text = await bot.reply(contact, 'disponibles 24/10', now);
    expect(text).toContain('no atendemos');
    expect(appointments.freeSlots).not.toHaveBeenCalled();
  });

  it('reserva y confirma con el horario', async () => {
    appointments.book.mockResolvedValue({ startsAt: slot });
    const text = await bot.reply(contact, 'turno 20/10 10:30', now);
    expect(appointments.book).toHaveBeenCalledWith(contact, slot, now);
    expect(text).toContain('mar 20/10 10:30');
    expect(text).toContain('cancelar 20/10 10:30');
  });

  it('traduce los errores del servicio a mensajes claros', async () => {
    appointments.book.mockRejectedValue(new AppointmentError('TAKEN'));
    expect(await bot.reply(contact, 'turno 20/10 10:30', now)).toContain('ya fue tomado');
  });

  it('lista mis turnos', async () => {
    appointments.upcoming.mockResolvedValue([{ startsAt: slot }]);
    expect(await bot.reply(contact, 'mis turnos', now)).toContain('• mar 20/10 10:30');
  });

  it('avisa si no tengo turnos', async () => {
    appointments.upcoming.mockResolvedValue([]);
    expect(await bot.reply(contact, 'mis turnos', now)).toContain('No tenés turnos');
  });

  it('cancela un turno', async () => {
    appointments.cancel.mockResolvedValue({ startsAt: slot });
    expect(await bot.reply(contact, 'cancelar 20/10 10:30', now)).toContain('cancelé tu turno');
  });

  it('pide los datos que faltan', async () => {
    expect(await bot.reply(contact, 'turno', now)).toContain('*turno 20/10 10:30*');
  });

  it('un error inesperado no se disfraza: se propaga', async () => {
    const boom = new Error('se cayó la base');
    appointments.book.mockRejectedValue(boom);
    await expect(bot.reply(contact, 'turno 20/10 10:30', now)).rejects.toBe(boom);
  });

  describe('frases libres (IA)', () => {
    it('un comando exacto no gasta IA', async () => {
      await bot.reply(contact, 'ayuda', now);
      expect(ai.reply).not.toHaveBeenCalled();
    });

    it('lo que no es un comando va a la IA y se responde lo que ella diga', async () => {
      ai.reply.mockResolvedValue('Tengo lugar el martes a las 15:00');
      const text = await bot.reply(contact, 'quiero algo el martes a la tarde', now);
      expect(ai.reply).toHaveBeenCalledWith(contact, 'quiero algo el martes a la tarde', now, null);
      expect(text).toBe('Tengo lugar el martes a las 15:00');
    });

    it('si la IA no está o falla, manda a la ayuda', async () => {
      ai.reply.mockResolvedValue(null);
      expect(await bot.reply(contact, 'quiero pizza', now)).toContain('*ayuda*');
    });
  });

  describe('confirmación de una acción pendiente', () => {
    const bookPending = { type: 'book' as const, startsAt: slot.toISOString() };

    it('con un "sí" ejecuta la reserva pendiente, sin pasar por la IA', async () => {
      contacts.getPending.mockReturnValue(bookPending);
      appointments.book.mockResolvedValue({ startsAt: slot });
      const text = await bot.reply(contact, 'Sí', now);
      expect(contacts.clearPending).toHaveBeenCalledWith(contact);
      expect(appointments.book).toHaveBeenCalledWith(contact, slot, now);
      expect(text).toContain('quedó reservado');
      expect(ai.reply).not.toHaveBeenCalled();
    });

    it('con un "no" descarta la acción y no hace nada', async () => {
      contacts.getPending.mockReturnValue(bookPending);
      const text = await bot.reply(contact, 'no', now);
      expect(contacts.clearPending).toHaveBeenCalledWith(contact);
      expect(appointments.book).not.toHaveBeenCalled();
      expect(text).toContain('no hice nada');
    });

    it('ejecuta una cancelación pendiente al confirmar', async () => {
      contacts.getPending.mockReturnValue({ type: 'cancel', startsAt: slot.toISOString() });
      appointments.cancel.mockResolvedValue({ startsAt: slot });
      expect(await bot.reply(contact, 'dale', now)).toContain('cancelé tu turno');
    });

    it('si entre el pedido y el "sí" otro tomó el horario, se avisa', async () => {
      contacts.getPending.mockReturnValue(bookPending);
      appointments.book.mockRejectedValue(new AppointmentError('TAKEN'));
      expect(await bot.reply(contact, 'sí', now)).toContain('ya fue tomado');
    });

    it('un "sí" sin nada pendiente no ejecuta nada', async () => {
      contacts.getPending.mockReturnValue(null);
      await bot.reply(contact, 'sí', now);
      expect(appointments.book).not.toHaveBeenCalled();
      expect(appointments.cancel).not.toHaveBeenCalled();
    });

    it('un comando nuevo reemplaza lo pendiente', async () => {
      contacts.getPending.mockReturnValue(bookPending);
      await bot.reply(contact, 'ayuda', now);
      expect(contacts.clearPending).toHaveBeenCalledWith(contact);
      expect(appointments.book).not.toHaveBeenCalled();
    });

    it('otra frase libre con algo pendiente va a la IA avisándole lo pendiente', async () => {
      contacts.getPending.mockReturnValue(bookPending);
      ai.reply.mockResolvedValue('Claro, ¿qué día?');
      await bot.reply(contact, 'mejor otro día', now);
      expect(ai.reply).toHaveBeenCalledWith(contact, 'mejor otro día', now, bookPending);
    });
  });
});
