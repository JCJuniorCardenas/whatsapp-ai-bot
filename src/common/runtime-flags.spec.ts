import { isSwaggerEnabled } from './runtime-flags';

describe('isSwaggerEnabled', () => {
  it('en desarrollo está activo por defecto', () => {
    expect(isSwaggerEnabled({})).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('en producción está apagado por defecto', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production' })).toBe(false);
  });

  it('SWAGGER_ENABLED lo fuerza en cualquier entorno', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'TRUE' })).toBe(true);
    expect(isSwaggerEnabled({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' })).toBe(false);
  });

  it('un valor que no es true/false se ignora', () => {
    expect(isSwaggerEnabled({ NODE_ENV: 'production', SWAGGER_ENABLED: 'quizás' })).toBe(false);
  });
});
