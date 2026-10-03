import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Contact } from '../contacts/contact.entity';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

// Solo el esquema: la lógica de agenda llega en una fase posterior.
@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Contact, { nullable: false, onDelete: 'CASCADE' })
  contact: Contact;

  @Column({ type: 'timestamptz' })
  startsAt: Date;

  @Column({ type: 'varchar', default: 'pending' })
  status: AppointmentStatus;

  @CreateDateColumn()
  createdAt: Date;
}
