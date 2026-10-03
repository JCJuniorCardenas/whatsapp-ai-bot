import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Contact } from './contact.entity';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  const repo = {
    findOneBy: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn(async (c) => c),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: getRepositoryToken(Contact), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(ContactsService);
  });

  it('crea el contacto si no existe', async () => {
    repo.findOneBy.mockResolvedValue(null);
    const c = await service.findOrCreate('5493770000000', 'Ana');
    expect(repo.save).toHaveBeenCalledWith({ phone: '5493770000000', name: 'Ana' });
    expect(c.phone).toBe('5493770000000');
  });

  it('devuelve el existente sin guardar si no cambió nada', async () => {
    const existing = { id: '1', phone: '549', name: 'Ana' };
    repo.findOneBy.mockResolvedValue(existing);
    expect(await service.findOrCreate('549', 'Ana')).toBe(existing);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('actualiza el nombre si cambió', async () => {
    repo.findOneBy.mockResolvedValue({ id: '1', phone: '549', name: null });
    const c = await service.findOrCreate('549', 'Ana');
    expect(c.name).toBe('Ana');
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});
