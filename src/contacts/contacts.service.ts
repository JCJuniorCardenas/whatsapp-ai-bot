import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact, PendingAction } from './contact.entity';

const PENDING_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(Contact) private readonly repo: Repository<Contact>,
  ) {}

  /** Devuelve el contacto de ese teléfono; si no existe, lo crea. */
  async findOrCreate(phone: string, name?: string): Promise<Contact> {
    const existing = await this.repo.findOneBy({ phone });
    if (existing) {
      if (name && existing.name !== name) {
        existing.name = name;
        return this.repo.save(existing);
      }
      return existing;
    }
    return this.repo.save(this.repo.create({ phone, name: name ?? null }));
  }

  /** Deja una acción esperando confirmación durante 10 minutos (reemplaza a la anterior). */
  setPending(contact: Contact, action: PendingAction, now = new Date()): Promise<Contact> {
    contact.pendingAction = action;
    contact.pendingExpiresAt = new Date(now.getTime() + PENDING_TTL_MS);
    return this.repo.save(contact);
  }

  clearPending(contact: Contact): Promise<Contact> {
    contact.pendingAction = null;
    contact.pendingExpiresAt = null;
    return this.repo.save(contact);
  }

  /** La acción pendiente, solo si todavía no venció. */
  getPending(contact: Contact, now = new Date()): PendingAction | null {
    if (!contact.pendingAction || !contact.pendingExpiresAt) return null;
    return contact.pendingExpiresAt > now ? contact.pendingAction : null;
  }

  /**
   * Cuenta una consulta a la IA para ese día. Devuelve false (sin contar) si ya
   * llegó al tope diario. `day` es la fecha argentina en formato YYYY-MM-DD.
   */
  async consumeAiQuota(contact: Contact, day: string, dailyLimit: number): Promise<boolean> {
    if (contact.aiUsageDay !== day) {
      contact.aiUsageDay = day;
      contact.aiUsageCount = 0;
    }
    if (contact.aiUsageCount >= dailyLimit) return false;
    contact.aiUsageCount += 1;
    await this.repo.save(contact);
    return true;
  }
}
