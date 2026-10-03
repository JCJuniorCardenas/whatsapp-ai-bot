import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
