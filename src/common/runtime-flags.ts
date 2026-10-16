type Env = Record<string, string | undefined>;

/**
 * ¿Se publica la documentación Swagger (/docs)?
 * Por defecto sí en desarrollo y NO en producción, donde expone la forma de la API a cualquiera.
 * SWAGGER_ENABLED=true o false lo fuerza en cualquier entorno.
 */
export function isSwaggerEnabled(env: Env): boolean {
  const forced = env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  return env.NODE_ENV !== 'production';
}
