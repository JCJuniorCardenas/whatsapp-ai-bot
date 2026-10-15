import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Contact } from '../contacts/contact.entity';

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled';

// Un horario solo puede tener un turno activo. Los cancelados no cuentan, así el horario se libera.
// Es el candado real contra dos personas reservando a la vez: lo garantiza la base, no el código.
@Entity('appointments')
@Index(['startsAt'], { unique: true, where: `"status" <> 'cancelled'` })
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
