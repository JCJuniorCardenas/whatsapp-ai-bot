import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Contact } from '../contacts/contact.entity';

export type MessageDirection = 'in' | 'out';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contact, { nullable: false, onDelete: 'CASCADE' })
  contact: Contact;

  @Column({ type: 'varchar' })
  direction: MessageDirection;

  @Column({ type: 'text' })
  body: string;

  /** ID del mensaje en WhatsApp. Único: así detectamos los reintentos de Meta. */
  @Index({ unique: true })
  @Column({ type: 'varchar', nullable: true })
  waMessageId: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
