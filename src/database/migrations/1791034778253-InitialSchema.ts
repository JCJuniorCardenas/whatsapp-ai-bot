import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1791034778253 implements MigrationInterface {
    name = 'InitialSchema1791034778253'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "contacts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phone" character varying NOT NULL, "name" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_84cae51c485079bdd8cdf1d828f" UNIQUE ("phone"), CONSTRAINT "PK_b99cd40cfd66a99f1571f4f72e6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "messages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "direction" character varying NOT NULL, "body" text NOT NULL, "waMessageId" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "contactId" uuid NOT NULL, CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_4c23267232c1d9708539fc00e6" ON "messages" ("waMessageId") `);
        await queryRunner.query(`CREATE TABLE "appointments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "startsAt" TIMESTAMP WITH TIME ZONE NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "contactId" uuid NOT NULL, CONSTRAINT "PK_4a437a9a27e948726b8bb3e36ad" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_435f12bd11014722a707a292763" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "appointments" ADD CONSTRAINT "FK_4ab9e0a344942dd40060cafddb6" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "appointments" DROP CONSTRAINT "FK_4ab9e0a344942dd40060cafddb6"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_435f12bd11014722a707a292763"`);
        await queryRunner.query(`DROP TABLE "appointments"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c23267232c1d9708539fc00e6"`);
        await queryRunner.query(`DROP TABLE "messages"`);
        await queryRunner.query(`DROP TABLE "contacts"`);
    }

}
