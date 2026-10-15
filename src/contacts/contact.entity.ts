import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Acción que el bot dejó esperando un "sí" de la persona. Se guarda ISO para sobrevivir a reinicios. */
export interface PendingAction {
  type: 'book' | 'cancel';
  startsAt: string;
}

@Entity('contacts')
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Teléfono tal como lo manda Meta (ej. 5493772692892). */
  @Column({ unique: true })
  phone: string;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  /** Reserva o cancelación esperando confirmación (la fuerza el código, no el modelo). */
  @Column({ type: 'jsonb', nullable: true })
  pendingAction: PendingAction | null;

  @Column({ type: 'timestamptz', nullable: true })
  pendingExpiresAt: Date | null;

  /** Día (YYYY-MM-DD, hora argentina) y cantidad de consultas a la IA de ese día. */
  @Column({ type: 'varchar', nullable: true })
  aiUsageDay: string | null;

  @Column({ type: 'int', default: 0 })
  aiUsageCount: number;

  @CreateDateColumn()
  createdAt: Date;
}
