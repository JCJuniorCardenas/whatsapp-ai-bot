import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { createHmac } from 'crypto';
import request from 'supertest';
import { BotService } from '../bot/bot.service';
import { ContactsService } from '../contacts/contacts.service';
import { MessagesService } from '../messages/messages.service';
import { SignatureGuard } from './signature.guard';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

const SECRET = 'secreto-de-test';
const env = {
  WHATSAPP_VERIFY_TOKEN: 'token-de-test',
  WHATSAPP_APP_SECRET: SECRET,
  WHATSAPP_TOKEN: 'token-graph',
  WHATSAPP_PHONE_NUMBER_ID: '12345',
  WHATSAPP_API_VERSION: 'v21.0',
};

const sign = (body: string) =>
  'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');

const payload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      changes: [
        {
          value: {
            messages: [
              { from: '5491100000000', id: 'm1', type: 'text', text: { body: 'hola' } },
            ],
          },
        },
      ],
    },
  ],
};

describe('Webhook de WhatsApp', () => {
  let app: INestApplication;
  let fetchMock: jest.Mock;
  const contacts = { findOrCreate: jest.fn() };
  const messages = { saveIncoming: jest.fn(), saveOutgoing: jest.fn() };
  const bot = { reply: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    contacts.findOrCreate.mockResolvedValue({ id: 'c1', phone: '5491100000000' });
    messages.saveIncoming.mockResolvedValue({ id: 'm1' });
    bot.reply.mockResolvedValue('respuesta del bot');
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => '',
      json: async () => ({ messages: [{ id: 'wamid.out' }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => env] }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
      ],
      controllers: [WhatsappController],
      providers: [
        WhatsappService,
        SignatureGuard,
        { provide: ContactsService, useValue: contacts },
        { provide: MessagesService, useValue: messages },
        { provide: BotService, useValue: bot },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    await app.init();
  });

  afterEach(() => app.close());

  describe('GET /webhook', () => {
    it('devuelve el challenge si el token es correcto', async () => {
      await request(app.getHttpServer())
        .get('/webhook')
        .query({ 'hub.mode': 'subscribe', 'hub.verify_token': env.WHATSAPP_VERIFY_TOKEN, 'hub.challenge': '777' })
        .expect(200)
        .expect('777');
    });

    it('rechaza con 403 si el token es incorrecto', async () => {
      await request(app.getHttpServer())
        .get('/webhook')
        .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'malo', 'hub.challenge': '777' })
        .expect(403);
    });

    it('frena con 429 a quien prueba tokens a ciegas (más de 10 intentos por minuto)', async () => {
      const intento = () =>
        request(app.getHttpServer())
          .get('/webhook')
          .query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'adivinando', 'hub.challenge': '1' });
      for (let i = 0; i < 10; i++) await intento().expect(403);
      await intento().expect(429);
    });
  });

  describe('POST /webhook', () => {
    it('rechaza con 401 si no hay firma', async () => {
      await request(app.getHttpServer()).post('/webhook').send(payload).expect(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rechaza con 401 si la firma es inválida', async () => {
      await request(app.getHttpServer())
        .post('/webhook')
        .set('x-hub-signature-256', 'sha256=' + '0'.repeat(64))
        .send(payload)
        .expect(401);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('no responde si el mensaje ya estaba guardado (reintento de Meta)', async () => {
      messages.saveIncoming.mockResolvedValue(null);
      const body = JSON.stringify(payload);
      await request(app.getHttpServer())
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sign(body))
        .send(body)
        .expect(200);
      await app.get(WhatsappService).idle();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('con firma válida responde lo que decide el bot por la Graph API', async () => {
      const body = JSON.stringify(payload);
      await request(app.getHttpServer())
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sign(body))
        .send(body)
        .expect(200);
      await app.get(WhatsappService).idle();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v21.0/12345/messages');
      expect(init.headers.Authorization).toBe('Bearer token-graph');
      expect(bot.reply).toHaveBeenCalledWith(expect.anything(), 'hola');
      expect(messages.saveIncoming).toHaveBeenCalledWith(expect.anything(), 'm1', 'hola');
      expect(messages.saveOutgoing).toHaveBeenCalledWith(expect.anything(), 'respuesta del bot', 'wamid.out');
      expect(JSON.parse(init.body)).toMatchObject({
        to: '541100000000', // se saca el 9 de los celulares argentinos
        text: { body: 'respuesta del bot' },
      });
    });

    it('le contesta 200 a Meta sin esperar a que el bot termine de pensar', async () => {
      let release!: (text: string) => void;
      bot.reply.mockReturnValue(new Promise<string>((resolve) => (release = resolve)));
      const body = JSON.stringify(payload);

      // supertest vuelve recién cuando llegó la respuesta HTTP: el bot sigue trabado y aun así hubo 200
      await request(app.getHttpServer())
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sign(body))
        .send(body)
        .expect(200)
        .expect('EVENT_RECEIVED');
      expect(fetchMock).not.toHaveBeenCalled();

      release('respuesta tardía');
      await app.get(WhatsappService).idle();
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).text.body).toBe('respuesta tardía');
    });

    it('los mensajes seguidos de una misma persona se procesan en orden, no en paralelo', async () => {
      const events: string[] = [];
      bot.reply.mockImplementation(async (_contact: unknown, text: string) => {
        events.push(`empieza ${text}`);
        await new Promise((r) => setTimeout(r, text === 'uno' ? 30 : 0));
        events.push(`termina ${text}`);
        return `re: ${text}`;
      });
      const two = {
        ...payload,
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { from: '5491100000000', id: 'm1', type: 'text', text: { body: 'uno' } },
                    { from: '5491100000000', id: 'm2', type: 'text', text: { body: 'dos' } },
                  ],
                },
              },
            ],
          },
        ],
      };
      const body = JSON.stringify(two);
      await request(app.getHttpServer())
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sign(body))
        .send(body)
        .expect(200);
      await app.get(WhatsappService).idle();
      expect(events).toEqual(['empieza uno', 'termina uno', 'empieza dos', 'termina dos']);
    });

    it('un mensaje que falla no frena al siguiente', async () => {
      bot.reply.mockRejectedValueOnce(new Error('se cayó la IA')).mockResolvedValueOnce('re: dos');
      const two = {
        ...payload,
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { from: '5491100000000', id: 'm1', type: 'text', text: { body: 'uno' } },
                    { from: '5491100000000', id: 'm2', type: 'text', text: { body: 'dos' } },
                  ],
                },
              },
            ],
          },
        ],
      };
      const body = JSON.stringify(two);
      await request(app.getHttpServer())
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sign(body))
        .send(body)
        .expect(200);
      await app.get(WhatsappService).idle();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(JSON.parse(fetchMock.mock.calls[0][1].body).text.body).toBe('re: dos');
    });
  });
});
