import { Module } from '@nestjs/common';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SignatureGuard } from './signature.guard';

@Module({
  imports: [ContactsModule, MessagesModule],
  controllers: [WhatsappController],
  providers: [WhatsappService, SignatureGuard],
})
export class WhatsappModule {}
