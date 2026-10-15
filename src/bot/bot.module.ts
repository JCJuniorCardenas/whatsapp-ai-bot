import { Module } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { BotService } from './bot.service';

@Module({
  imports: [AppointmentsModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
