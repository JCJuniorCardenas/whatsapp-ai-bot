import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { SignatureGuard } from './signature.guard';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, SignatureGuard],
})
export class WhatsappModule {}
