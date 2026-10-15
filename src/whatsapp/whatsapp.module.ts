import { Module } from '@nestjs/common';
import { BotModule } from '../bot/bot.module';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SignatureGuard } from './signature.guard';

@Module({
  imports: [BotModule, ContactsModule, MessagesModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, SignatureGuard],
})
export class WhatsappModule {}
