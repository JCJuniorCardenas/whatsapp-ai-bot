import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookPayload } from './whatsapp.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly config: ConfigService) {}

  /** Envía un mensaje de texto por la Graph API de WhatsApp Cloud. */
  async sendTextMessage(to: string, body: string): Promise<void> {
    const version = this.config.getOrThrow<string>('WHATSAPP_API_VERSION');
    const phoneId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    const token = this.config.getOrThrow<string>('WHATSAPP_TOKEN');

    const res = await fetch(
      `https://graph.facebook.com/${version}/${phoneId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Graph API respondió ${res.status}: ${await res.text()}`);
    }
  }

  /** Recorre el payload de Meta y responde un eco a cada mensaje de texto. */
  async handleIncoming(payload: WhatsappWebhookPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const message of change.value?.messages ?? []) {
          this.logger.log(`Mensaje recibido (${message.type}) de ${message.from}`);
          if (message.type !== 'text' || !message.text) continue;
          try {
            await this.sendTextMessage(message.from, `Eco: ${message.text.body}`);
            this.logger.log(`Eco enviado a ${message.from}`);
          } catch (err) {
            // No tiramos el error: si el webhook devuelve 500, Meta reintenta y duplica mensajes.
            this.logger.error(`No se pudo responder a ${message.from}`, err);
          }
        }
      }
    }
  }
}
