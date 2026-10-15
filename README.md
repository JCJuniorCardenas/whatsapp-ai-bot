# WhatsApp AI Bot

Bot de WhatsApp para agendar turnos. **Fase 1:** webhook de Meta + eco del mensaje (sin IA ni base de datos todavía).

Stack: NestJS, TypeScript, PostgreSQL con TypeORM, Swagger, Jest. Deploy en Railway.

**Fase 2:** se guardan contactos y mensajes en PostgreSQL y se ignoran los reintentos de Meta (no se responde dos veces al mismo mensaje).

## Cómo correrlo

```bash
npm install
cp .env.example .env   # y completá los valores (ver abajo)
docker compose up -d   # levanta PostgreSQL (necesita Docker Desktop abierto)
npm run start:dev      # aplica las migraciones al arrancar
```

PostgreSQL queda en el puerto **5433** para no chocar con un Postgres instalado en tu máquina.

### Migraciones

```bash
npm run migration:generate -- src/database/migrations/NombreDelCambio   # después de cambiar una entidad
npm run migration:run
npm run migration:revert
```

- Swagger: http://localhost:3000/docs
- Tests: `npm test`

## Variables de entorno

| Variable | Qué es |
|---|---|
| `PORT` | Puerto local (3000 por defecto) |
| `WHATSAPP_VERIFY_TOKEN` | Texto que inventás vos; debe coincidir con el del panel de Meta |
| `WHATSAPP_APP_SECRET` | App Secret de tu app de Meta (para validar la firma) |
| `WHATSAPP_TOKEN` | Token de acceso de la Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono de prueba/real |
| `WHATSAPP_API_VERSION` | Versión de la Graph API, ej. `v25.0` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a PostgreSQL (los de `.env.example` sirven para Docker local) |

Nunca subas el `.env` (está en `.gitignore`).

## Endpoints

- `GET /webhook`: verificación de Meta (`hub.mode`, `hub.verify_token`, `hub.challenge`).
- `POST /webhook`: recibe mensajes. Valida `X-Hub-Signature-256` con HMAC-SHA256 y responde un eco.

## Probarlo con un túnel local

1. Levantá el bot: `npm run start:dev`.
2. Abrí un túnel al puerto 3000, por ejemplo con ngrok: `ngrok http 3000` (o `cloudflared tunnel --url http://localhost:3000`). Copiá la URL `https://...`.
3. En [developers.facebook.com](https://developers.facebook.com) > tu app > WhatsApp > Configuración:
   - Callback URL: `https://TU-URL/webhook`
   - Verify token: el mismo valor de `WHATSAPP_VERIFY_TOKEN`
   - Tocá **Verificar y guardar** y suscribite al campo `messages`.
4. Completá el `.env` (App Secret en Configuración > Básica; token y phone number ID en WhatsApp > Configuración de la API) y reiniciá el bot.
5. Desde tu celular (agregado como número de prueba) mandá un mensaje al número de prueba: el bot responde `Eco: <tu mensaje>`.

## Deploy en Railway

1. Subí el repo a GitHub y en [railway.app](https://railway.com) creá un proyecto con **Deploy from GitHub repo**.
2. En el mismo proyecto agregá una base: **New > Database > PostgreSQL**.
3. En el servicio del bot, pestaña **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (referencia a la base; sin SSL porque es red interna)
   - `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`
4. **Settings > Networking > Generate Domain** y usá `https://TU-DOMINIO/webhook` como URL en Meta.
5. El chequeo de salud es `/health` y las migraciones se aplican solas al arrancar (ver `railway.json`).

## Problemas comunes con Meta

- **El bot no recibe mensajes reales (el botón "Probar" sí funciona):** la cuenta de WhatsApp tiene que estar suscrita a tu app. Se hace con `POST /{WABA_ID}/subscribed_apps` en la Graph API.
- **Error 131030 "not in allowed list" con un número argentino:** Meta entrega `549...` pero la lista de destinatarios guarda `54...`. El bot ya le saca el 9 (`src/whatsapp/normalize-phone.ts`).
- **Error 190 "Authentication Error":** el token temporal dura 24 hs. Generá uno nuevo en WhatsApp > Configuración de la API.
- **Dejó de llegar todo:** el túnel gratis de Cloudflare se cayó o cambió de URL. Levantá uno nuevo y cargá la URL en Meta (Configurar webhooks).
