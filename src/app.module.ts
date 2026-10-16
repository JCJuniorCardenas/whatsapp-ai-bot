import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { parseScheduleConfig } from './appointments/schedule';
import { buildDataSourceOptions } from './database/database.config';
import { HealthModule } from './health/health.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Si el horario está mal escrito, la app no arranca y dice exactamente qué corregir.
      validate: (env) => {
        parseScheduleConfig(env);
        return env;
      },
    }),
    // Límite general por IP: 300 pedidos por minuto (la verificación del webhook es más estricta).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...buildDataSourceOptions((k) => config.get<string>(k)),
        migrationsRun: true, // aplica las migraciones pendientes al arrancar
      }),
    }),
    HealthModule,
    WhatsappModule,
  ],
})
export class AppModule {}
