import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Teléfono tal como lo manda Meta (ej. 5493772692892). */
  @Column({ unique: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
