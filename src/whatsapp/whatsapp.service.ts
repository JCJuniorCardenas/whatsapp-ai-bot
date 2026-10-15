import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotService } from '../bot/bot.service';
import { ContactsService } from '../contacts/contacts.service';
import { MessagesService } from '../messages/messages.service';
import { normalizeRecipient } from './normalize-phone';
import { WhatsappWebhookPayload } from './whatsapp.types';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly contacts: ContactsService,
    private readonly messages: MessagesService,
    private readonly bot: BotService,
  ) {}

  /** Envía un mensaje de texto por la Graph API. Devuelve el ID del mensaje en WhatsApp. */
  async sendTextMessage(to: string, body: string): Promise<string | null> {
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
          to: normalizeRecipient(to),
          type: 'text',
          text: { body },
        }),
      },
    );

    if (!res.ok) {
      throw new Error(`Graph API respondió ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return data.messages?.[0]?.id ?? null;
  }

  /** Guarda cada mensaje de texto y le responde lo que decida el bot (una sola vez por mensaje). */
  async handleIncoming(payload: WhatsappWebhookPayload): Promise<void> {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const names = new Map(
          (change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
        );
        for (const message of change.value?.messages ?? []) {
          this.logger.log(`Mensaje recibido (${message.type}) de ${message.from}`);
          if (message.type !== 'text' || !message.text) continue;
          try {
            const contact = await this.contacts.findOrCreate(
              message.from,
              names.get(message.from),
            );
            const saved = await this.messages.saveIncoming(
              contact,
              message.id,
              message.text.body,
            );
            if (!saved) {
              this.logger.warn(`Mensaje ${message.id} repetido, se ignora`);
              continue;
            }
            const reply = await this.bot.reply(contact, message.text.body);
            const waId = await this.sendTextMessage(message.from, reply);
            await this.messages.saveOutgoing(contact, reply, waId);
            this.logger.log(`Respuesta enviada a ${message.from}`);
          } catch (err) {
            // No tiramos el error: si el webhook devuelve 500, Meta reintenta y duplica mensajes.
            this.logger.error(`No se pudo procesar el mensaje de ${message.from}`, err);
          }
        }
      }
    }
  }
}
