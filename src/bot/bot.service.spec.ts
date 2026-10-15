import { Test } from '@nestjs/testing';
import { AppointmentError, AppointmentsService } from '../appointments/appointments.service';
import { fromLocal } from '../appointments/schedule';
import { Contact } from '../contacts/contact.entity';
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
  const contact = { id: 'c1' } as Contact;
  // Jueves 15/10/2026 12:00 hora argentina
  const now = fromLocal(2026, 10, 15, 12, 0);
  const slot = fromLocal(2026, 10, 20, 10, 30);

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [BotService, { provide: AppointmentsService, useValue: appointments }],
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

  it('si no entiende, manda a la ayuda', async () => {
    expect(await bot.reply(contact, 'quiero pizza', now)).toContain('*ayuda*');
  });

  it('un error inesperado no se disfraza: se propaga', async () => {
    const boom = new Error('se cayó la base');
    appointments.book.mockRejectedValue(boom);
    await expect(bot.reply(contact, 'turno 20/10 10:30', now)).rejects.toBe(boom);
  });
});
