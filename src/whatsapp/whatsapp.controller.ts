import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SignatureGuard } from './signature.guard';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookPayload } from './whatsapp.types';

@ApiTags('whatsapp')
@Controller('webhook')
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Verificación del webhook (la llama Meta)' })
  @ApiQuery({ name: 'hub.mode' })
  @ApiQuery({ name: 'hub.verify_token' })
  @ApiQuery({ name: 'hub.challenge' })
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ): string {
    const expected = this.config.getOrThrow<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode !== 'subscribe' || token !== expected) {
      throw new ForbiddenException('Token de verificación inválido');
    }
    return challenge;
  }

  @Post()
  @HttpCode(200)
  @UseGuards(SignatureGuard)
  @ApiOperation({ summary: 'Recibe mensajes de WhatsApp (firmado por Meta)' })
  receive(@Body() payload: WhatsappWebhookPayload): string {
    // Se contesta 200 enseguida y se procesa en segundo plano (la IA puede tardar).
    this.whatsapp.accept(payload);
    return 'EVENT_RECEIVED';
  }
}
