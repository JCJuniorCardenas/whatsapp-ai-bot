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

describe('ContactsService (confirmaciones y cuota de IA)', () => {
  let service: ContactsService;
  const repo = {
    findOneBy: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn(async (c) => c),
  };
  const now = new Date('2026-10-15T15:00:00Z');
  const makeContact = (extra: Partial<Contact> = {}) =>
    ({ id: 'c1', pendingAction: null, pendingExpiresAt: null, aiUsageDay: null, aiUsageCount: 0, ...extra }) as Contact;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ContactsService, { provide: getRepositoryToken(Contact), useValue: repo }],
    }).compile();
    service = moduleRef.get(ContactsService);
  });

  it('guarda una acción pendiente que vence a los 10 minutos', async () => {
    const c = await service.setPending(makeContact(), { type: 'book', startsAt: '2026-10-20T13:30:00.000Z' }, now);
    expect(c.pendingAction).toEqual({ type: 'book', startsAt: '2026-10-20T13:30:00.000Z' });
    expect(c.pendingExpiresAt).toEqual(new Date('2026-10-15T15:10:00Z'));
  });

  it('getPending devuelve la acción solo mientras no venció', () => {
    const action = { type: 'cancel' as const, startsAt: '2026-10-20T13:30:00.000Z' };
    const vigente = makeContact({ pendingAction: action, pendingExpiresAt: new Date('2026-10-15T15:05:00Z') });
    const vencida = makeContact({ pendingAction: action, pendingExpiresAt: new Date('2026-10-15T14:59:00Z') });
    expect(service.getPending(vigente, now)).toEqual(action);
    expect(service.getPending(vencida, now)).toBeNull();
    expect(service.getPending(makeContact(), now)).toBeNull();
  });

  it('clearPending borra la acción', async () => {
    const c = await service.clearPending(makeContact({ pendingAction: { type: 'book', startsAt: 'x' }, pendingExpiresAt: now }));
    expect(c.pendingAction).toBeNull();
    expect(c.pendingExpiresAt).toBeNull();
  });

  it('cuenta consultas de IA hasta el tope diario y después rechaza', async () => {
    const c = makeContact();
    expect(await service.consumeAiQuota(c, '2026-10-15', 2)).toBe(true);
    expect(await service.consumeAiQuota(c, '2026-10-15', 2)).toBe(true);
    expect(await service.consumeAiQuota(c, '2026-10-15', 2)).toBe(false);
    expect(c.aiUsageCount).toBe(2);
  });

  it('reinicia el contador al cambiar el día', async () => {
    const c = makeContact({ aiUsageDay: '2026-10-14', aiUsageCount: 20 });
    expect(await service.consumeAiQuota(c, '2026-10-15', 20)).toBe(true);
    expect(c).toMatchObject({ aiUsageDay: '2026-10-15', aiUsageCount: 1 });
  });
});
