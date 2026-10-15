import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, MoreThan, Not, Repository } from 'typeorm';
import { Contact } from '../contacts/contact.entity';
import { Appointment } from './appointment.entity';
import {
  addDays,
  isValidSlot,
  LocalDate,
  MAX_DAYS_AHEAD,
  slotsOfDay,
  todayLocal,
} from './schedule';

export type AppointmentErrorCode =
  | 'PAST'
  | 'TOO_FAR'
  | 'OUTSIDE_HOURS'
  | 'TAKEN'
  | 'NOT_FOUND';

export class AppointmentError extends Error {
  constructor(readonly code: AppointmentErrorCode) {
    super(code);
  }
}

export interface DayAvailability {
  day: LocalDate;
  slots: Date[];
}

const DAY_MS = 86_400_000;

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly repo: Repository<Appointment>,
  ) {}

  /** Turnos libres de un día (descarta los pasados y los ya reservados). */
  async freeSlots(day: LocalDate, now = new Date()): Promise<Date[]> {
    const upcoming = slotsOfDay(day).filter((s) => s > now);
    if (upcoming.length === 0) return [];
    const taken = await this.repo.find({
      where: {
        startsAt: Between(upcoming[0], upcoming[upcoming.length - 1]),
        status: Not('cancelled'),
      },
    });
    const takenAt = new Set(taken.map((a) => a.startsAt.getTime()));
    return upcoming.filter((s) => !takenAt.has(s.getTime()));
  }

  /** Los próximos días que tengan turnos libres (máximo `maxDays`). */
  async nextAvailability(now = new Date(), maxDays = 3): Promise<DayAvailability[]> {
    const today = todayLocal(now);
    const result: DayAvailability[] = [];
    for (let i = 0; i <= MAX_DAYS_AHEAD && result.length < maxDays; i++) {
      const day = addDays(today, i);
      const slots = await this.freeSlots(day, now);
      if (slots.length > 0) result.push({ day, slots });
    }
    return result;
  }

  async book(contact: Contact, startsAt: Date, now = new Date()): Promise<Appointment> {
    if (startsAt <= now) throw new AppointmentError('PAST');
    if (startsAt.getTime() > now.getTime() + MAX_DAYS_AHEAD * DAY_MS) {
      throw new AppointmentError('TOO_FAR');
    }
    if (!isValidSlot(startsAt)) throw new AppointmentError('OUTSIDE_HOURS');
    try {
      return await this.repo.save(
        this.repo.create({ contact, startsAt, status: 'confirmed' }),
      );
    } catch (err) {
      // 23505 = violación de unicidad en Postgres: alguien reservó ese horario antes.
      if ((err as { driverError?: { code?: string } })?.driverError?.code === '23505') {
        throw new AppointmentError('TAKEN');
      }
      throw err;
    }
  }

  upcoming(contact: Contact, now = new Date()): Promise<Appointment[]> {
    return this.repo.find({
      where: {
        contact: { id: contact.id },
        status: Not('cancelled'),
        startsAt: MoreThan(now),
      },
      order: { startsAt: 'ASC' },
    });
  }

  async cancel(contact: Contact, startsAt: Date, now = new Date()): Promise<Appointment> {
    const found = await this.repo.findOne({
      where: {
        contact: { id: contact.id },
        startsAt,
        status: Not('cancelled'),
      },
    });
    if (!found || found.startsAt <= now) throw new AppointmentError('NOT_FOUND');
    found.status = 'cancelled';
    return this.repo.save(found);
  }
}
