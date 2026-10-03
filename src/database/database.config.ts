import { DataSourceOptions } from 'typeorm';

type Getter = (key: string) => string | undefined;

/** Config de TypeORM compartida por la app y por el CLI de migraciones. */
export function buildDataSourceOptions(get: Getter): DataSourceOptions {
  return {
    type: 'postgres',
    host: get('DB_HOST') ?? 'localhost',
    port: Number(get('DB_PORT') ?? 5432),
    username: get('DB_USER'),
    password: get('DB_PASSWORD'),
    database: get('DB_NAME'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/migrations/*{.ts,.js}'],
  };
}
