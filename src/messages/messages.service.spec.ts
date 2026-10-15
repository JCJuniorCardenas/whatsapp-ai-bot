import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contact } from '../contacts/contact.entity';
import { Message } from './message.entity';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;
  const repo = {
    find: jest.fn(),
    existsBy: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn(async (m) => m),
  };
  const contact = { id: 'c1', phone: '549' } as Contact;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        MessagesService,
        { provide: getRepositoryToken(Message), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(MessagesService);
  });

  it('guarda un mensaje entrante nuevo', async () => {
    repo.existsBy.mockResolvedValue(false);
    const m = await service.saveIncoming(contact, 'wamid.1', 'hola');
    expect(m).toMatchObject({ direction: 'in', body: 'hola', waMessageId: 'wamid.1' });
  });

  it('devuelve null si el mensaje ya estaba guardado (reintento de Meta)', async () => {
    repo.existsBy.mockResolvedValue(true);
    expect(await service.saveIncoming(contact, 'wamid.1', 'hola')).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('recent devuelve los mensajes del más viejo al más nuevo', async () => {
    repo.find.mockResolvedValue([{ body: 'tercero' }, { body: 'segundo' }, { body: 'primero' }]);
    const list = await service.recent(contact, new Date('2026-10-14T00:00:00Z'), 3);
    expect(list.map((m) => m.body)).toEqual(['primero', 'segundo', 'tercero']);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ take: 3, order: { createdAt: 'DESC' } }));
  });

  it('guarda un mensaje saliente', async () => {
    const m = await service.saveOutgoing(contact, 'Eco: hola', 'wamid.2');
    expect(m).toMatchObject({ direction: 'out', waMessageId: 'wamid.2' });
  });
});
