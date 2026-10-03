import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contact } from './contact.entity';

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
}
