import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('responde ok', () => {
    expect(new HealthController().check()).toEqual({ status: 'ok' });
  });
});
