import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Contact } from '../contacts/contact.entity';
import { Message } from './message.entity';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly repo: Repository<Message>,
  ) {}

  /**
   * Guarda un mensaje recibido. Devuelve null si ya lo teníamos
   * (Meta reintenta los webhooks y no queremos responder dos veces).
   */
  async saveIncoming(
    contact: Contact,
    waMessageId: string,
    body: string,
  ): Promise<Message | null> {
    if (await this.repo.existsBy({ waMessageId })) return null;
    return this.repo.save(
      this.repo.create({ contact, direction: 'in', body, waMessageId }),
    );
  }

  /** Últimos mensajes de esa persona desde `since`, del más viejo al más nuevo. */
  async recent(contact: Contact, since: Date, limit = 10): Promise<Message[]> {
    const rows = await this.repo.find({
      where: { contact: { id: contact.id }, createdAt: MoreThan(since) },
      order: { createdAt: 'DESC' },
      take: limit,
    });
    return rows.reverse();
  }

  saveOutgoing(
    contact: Contact,
    body: string,
    waMessageId: string | null = null,
  ): Promise<Message> {
    return this.repo.save(
      this.repo.create({ contact, direction: 'out', body, waMessageId }),
    );
  }
}
