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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SignatureGuard } from './signature.guard';
import { WhatsappService } from './whatsapp.service';
import { WhatsappWebhookPayload } from './whatsapp.types';

const VERIFY_LIMIT_PER_MINUTE = 10;

// Límite por IP y por minuto. Los mensajes de Meta llegan en ráfagas, así que ahí es amplio;
// la verificación (GET) acepta el token por la URL, así que es estricta contra los intentos a ciegas.
@ApiTags('whatsapp')
@Controller('webhook')
@UseGuards(ThrottlerGuard)
export class WhatsappController {
  constructor(
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  @Throttle({ default: { limit: VERIFY_LIMIT_PER_MINUTE, ttl: 60_000 } })
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
