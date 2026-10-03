import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contact } from '../contacts/contact.entity';
import { Message } from './message.entity';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let service: MessagesService;
  const repo = {
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

  it('guarda un mensaje saliente', async () => {
    const m = await service.saveOutgoing(contact, 'Eco: hola', 'wamid.2');
    expect(m).toMatchObject({ direction: 'out', waMessageId: 'wamid.2' });
  });
});
