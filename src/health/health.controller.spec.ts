import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  const dataSource = { query: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: getDataSourceToken(), useValue: dataSource }],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('responde ok si la base contesta', async () => {
    dataSource.query.mockResolvedValue([{ '?column?': 1 }]);
    await expect(controller.check()).resolves.toEqual({ status: 'ok', db: 'up' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT 1');
  });

  it('responde 503 si la base no contesta', async () => {
    dataSource.query.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
