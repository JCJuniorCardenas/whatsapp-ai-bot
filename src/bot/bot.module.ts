import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ContactsModule } from '../contacts/contacts.module';
import { BotService } from './bot.service';

@Module({
  imports: [AiModule, AppointmentsModule, ContactsModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}
