import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contact } from '../contacts/contact.entity';
import { Appointment } from './appointment.entity';
import { AppointmentError, AppointmentsService } from './appointments.service';
import { fromLocal } from './schedule';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  const repo = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn(async (a) => a),
  };
  const contact = { id: 'c1' } as Contact;
  // Jueves 15/10/2026 12:00 hora argentina
  const now = fromLocal(2026, 10, 15, 12, 0);

  beforeEach(async () => {
    jest.clearAllMocks();
    repo.find.mockResolvedValue([]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: getRepositoryToken(Appointment), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(AppointmentsService);
  });

  describe('freeSlots', () => {
    it('descarta los horarios que ya pasaron hoy', async () => {
      const slots = await service.freeSlots({ y: 2026, m: 10, d: 15 }, now);
      expect(slots[0]).toEqual(fromLocal(2026, 10, 15, 12, 30));
    });

    it('descarta los reservados', async () => {
      repo.find.mockResolvedValue([{ startsAt: fromLocal(2026, 10, 20, 10, 0) }]);
      const slots = await service.freeSlots({ y: 2026, m: 10, d: 20 }, now);
      expect(slots).toHaveLength(17);
      expect(slots).not.toContainEqual(fromLocal(2026, 10, 20, 10, 0));
    });

    it('devuelve vacío en fin de semana sin consultar la base', async () => {
      expect(await service.freeSlots({ y: 2026, m: 10, d: 24 }, now)).toEqual([]);
      expect(repo.find).not.toHaveBeenCalled();
    });
  });

  describe('nextAvailability', () => {
    it('saltea el fin de semana y junta 3 días', async () => {
      const days = await service.nextAvailability(now, 3);
      expect(days.map((d) => d.day.d)).toEqual([15, 16, 19]); // jue, vie, lun
    });
  });

  describe('book', () => {
    const slot = fromLocal(2026, 10, 20, 10, 30);

    it('reserva y deja el turno confirmado', async () => {
      const a = await service.book(contact, slot, now);
      expect(a).toMatchObject({ contact, startsAt: slot, status: 'confirmed' });
    });

    it('rechaza horarios pasados', async () => {
      await expect(
        service.book(contact, fromLocal(2026, 10, 15, 9, 0), now),
      ).rejects.toMatchObject({ code: 'PAST' });
    });

    it('rechaza horarios fuera de agenda', async () => {
      await expect(
        service.book(contact, fromLocal(2026, 10, 20, 10, 15), now),
      ).rejects.toMatchObject({ code: 'OUTSIDE_HOURS' });
      await expect(
        service.book(contact, fromLocal(2026, 10, 24, 10, 0), now),
      ).rejects.toMatchObject({ code: 'OUTSIDE_HOURS' });
    });

    it('rechaza fechas demasiado lejanas', async () => {
      await expect(
        service.book(contact, fromLocal(2027, 3, 1, 10, 0), now),
      ).rejects.toMatchObject({ code: 'TOO_FAR' });
    });

    it('si la base dice que el horario ya está tomado, responde TAKEN', async () => {
      repo.save.mockRejectedValueOnce({ driverError: { code: '23505' } });
      const promise = service.book(contact, slot, now);
      await expect(promise).rejects.toBeInstanceOf(AppointmentError);
      repo.save.mockRejectedValueOnce({ driverError: { code: '23505' } });
      await expect(service.book(contact, slot, now)).rejects.toMatchObject({
        code: 'TAKEN',
      });
    });

    it('propaga errores inesperados de la base', async () => {
      const boom = new Error('se cayó la base');
      repo.save.mockRejectedValueOnce(boom);
      await expect(service.book(contact, slot, now)).rejects.toBe(boom);
    });
  });

  describe('cancel', () => {
    const slot = fromLocal(2026, 10, 20, 10, 30);

    it('cancela un turno propio', async () => {
      repo.findOne.mockResolvedValue({ id: 'a1', startsAt: slot, status: 'confirmed' });
      const a = await service.cancel(contact, slot, now);
      expect(a.status).toBe('cancelled');
    });

    it('NOT_FOUND si no existe', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.cancel(contact, slot, now)).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });
});
