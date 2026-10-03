import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config';

// El CLI de TypeORM no pasa por Nest, así que cargamos el .env a mano.
try {
  process.loadEnvFile();
} catch {
  // sin .env: se usan las variables que ya estén en el entorno (ej. Render)
}

export default new DataSource(buildDataSourceOptions((k) => process.env[k]));
