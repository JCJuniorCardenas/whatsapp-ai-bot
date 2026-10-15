import { MigrationInterface, QueryRunner } from "typeorm";

export class UniqueActiveAppointmentSlot1792074038781 implements MigrationInterface {
    name = 'UniqueActiveAppointmentSlot1792074038781'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_281d98791b286264087643320d" ON "appointments" ("startsAt") WHERE "status" <> 'cancelled'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_281d98791b286264087643320d"`);
    }

}
