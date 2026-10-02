# WhatsApp AI Bot

Bot de WhatsApp para agendar turnos. **Fase 1:** webhook de Meta + eco del mensaje (sin IA ni base de datos todavía).

Stack: NestJS, TypeScript, Swagger, Jest. (PostgreSQL/TypeORM y deploy en Render vienen en próximas fases.)

## Cómo correrlo

```bash
npm install
cp .env.example .env   # y completá los valores (ver abajo)
npm run start:dev
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
| `WHATSAPP_API_VERSION` | Versión de la Graph API, ej. `v21.0` |

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
