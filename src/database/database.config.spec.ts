import { buildDataSourceOptions } from './database.config';

const from = (env: Record<string, string>) => (k: string) => env[k];

describe('buildDataSourceOptions', () => {
  it('usa las variables DB_* en local', () => {
    const o: any = buildDataSourceOptions(
      from({ DB_HOST: 'h', DB_PORT: '5433', DB_USER: 'u', DB_PASSWORD: 'p', DB_NAME: 'n' }),
    );
    expect(o).toMatchObject({ host: 'h', port: 5433, username: 'u', database: 'n', ssl: false });
    expect(o.url).toBeUndefined();
  });

  it('prefiere DATABASE_URL si existe', () => {
    const o: any = buildDataSourceOptions(
      from({ DATABASE_URL: 'postgres://u:p@host/db', DB_HOST: 'ignorado' }),
    );
    expect(o.url).toBe('postgres://u:p@host/db');
    expect(o.host).toBeUndefined();
  });

  it('activa SSL con DB_SSL=true', () => {
    const o: any = buildDataSourceOptions(from({ DB_SSL: 'true' }));
    expect(o.ssl).toEqual({ rejectUnauthorized: false });
  });
});
