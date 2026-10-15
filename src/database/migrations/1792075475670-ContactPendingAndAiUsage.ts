import { MigrationInterface, QueryRunner } from "typeorm";

export class ContactPendingAndAiUsage1792075475670 implements MigrationInterface {
    name = 'ContactPendingAndAiUsage1792075475670'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contacts" ADD "pendingAction" jsonb`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD "pendingExpiresAt" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD "aiUsageDay" character varying`);
        await queryRunner.query(`ALTER TABLE "contacts" ADD "aiUsageCount" integer NOT NULL DEFAULT '0'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "contacts" DROP COLUMN "aiUsageCount"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP COLUMN "aiUsageDay"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP COLUMN "pendingExpiresAt"`);
        await queryRunner.query(`ALTER TABLE "contacts" DROP COLUMN "pendingAction"`);
    }

}
