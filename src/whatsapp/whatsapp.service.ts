import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotService } from '../bot/bot.service';
import { ContactsService } from '../contacts/contacts.service';
import { MessagesService } from '../messages/messages.service';
import { normalizeRecipient } from './normalize-phone';
import { KeyedQueue } from '../common/keyed-queue';
import { WhatsappMessage, WhatsappWebhookPayload } from './whatsapp.types';

const SHUTDOWN_WAIT_MS = 15_000;

@Injectable()
export class WhatsappService implements OnApplicationShutdown {
  private readonly logger = new Logger(WhatsappService.name);
  private readonly queue = new KeyedQueue();
  private readonly inflight = new Set<Promise<void>>();

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

  /**
   * Acepta el payload de Meta y lo procesa en segundo plano: devuelve enseguida para
   * poder contestarle 200 a Meta sin esperar a la IA (que puede tardar varios segundos).
   */
  accept(payload: WhatsappWebhookPayload): void {
    const task: Promise<void> = this.handleIncoming(payload)
      .catch((err) => this.logger.error('Falló el procesamiento del webhook', err))
      .finally(() => this.inflight.delete(task));
    this.inflight.add(task);
  }

  /** Se resuelve cuando no queda ningún webhook procesándose. */
  async idle(): Promise<void> {
    await Promise.allSettled([...this.inflight]);
  }

  /** Al apagar (ej. un deploy nuevo) espera a terminar lo que está en curso, hasta 15 s. */
  async onApplicationShutdown(): Promise<void> {
    if (this.inflight.size === 0) return;
    this.logger.log(`Esperando ${this.inflight.size} mensaje(s) en curso antes de apagar`);
    await Promise.race([this.idle(), new Promise((resolve) => setTimeout(resolve, SHUTDOWN_WAIT_MS))]);
  }

  /** Guarda cada mensaje de texto y le responde lo que decida el bot (una sola vez por mensaje). */
  async handleIncoming(payload: WhatsappWebhookPayload): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const names = new Map(
          (change.value?.contacts ?? []).map((c) => [c.wa_id, c.profile?.name]),
        );
        for (const message of change.value?.messages ?? []) {
          this.logger.log(`Mensaje recibido (${message.type}) de ${message.from}`);
          if (message.type !== 'text' || !message.text) continue;
          // Los mensajes de una misma persona se procesan de a uno, en orden.
          jobs.push(
            this.queue.run(message.from, () => this.processText(message, names.get(message.from))),
          );
        }
      }
    }
    await Promise.all(jobs);
  }

  private async processText(message: WhatsappMessage, name?: string): Promise<void> {
    const body = message.text?.body ?? '';
    try {
      const contact = await this.contacts.findOrCreate(message.from, name);
      const saved = await this.messages.saveIncoming(contact, message.id, body);
      if (!saved) {
        this.logger.warn(`Mensaje ${message.id} repetido, se ignora`);
        return;
      }
      const reply = await this.bot.reply(contact, body);
      const waId = await this.sendTextMessage(message.from, reply);
      await this.messages.saveOutgoing(contact, reply, waId);
      this.logger.log(`Respuesta enviada a ${message.from}`);
    } catch (err) {
      // Un error con un mensaje no debe frenar a los demás.
      this.logger.error(`No se pudo procesar el mensaje de ${message.from}`, err);
    }
  }
}
