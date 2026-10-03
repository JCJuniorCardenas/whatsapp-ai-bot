import { DataSourceOptions } from 'typeorm';

type Getter = (key: string) => string | undefined;

/**
 * Config de TypeORM compartida por la app y por el CLI de migraciones.
 * Si existe DATABASE_URL (así la entrega Render) se usa esa; si no, las variables DB_*.
 * DB_SSL=true activa SSL (hace falta al conectarse desde afuera de Render).
 */
export function buildDataSourceOptions(get: Getter): DataSourceOptions {
  const common = {
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
    ssl: get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
  };
  const url = get('DATABASE_URL');
  if (url) {
    return { type: 'postgres', url, ...common };
  }
  return {
    type: 'postgres',
    host: get('DB_HOST') ?? 'localhost',
    port: Number(get('DB_PORT') ?? 5432),
    username: get('DB_USER'),
    password: get('DB_PASSWORD'),
    database: get('DB_NAME'),
    ...common,
  };
}
