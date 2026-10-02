import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Valida el header X-Hub-Signature-256 que manda Meta:
 * "sha256=" + HMAC-SHA256(body crudo, App Secret).
 */
@Injectable()
export class SignatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { rawBody?: Buffer }>();
    const header = req.header('x-hub-signature-256');

    if (!header || !req.rawBody) {
      throw new UnauthorizedException('Falta la firma');
    }

    const secret = this.config.getOrThrow<string>('WHATSAPP_APP_SECRET');
    const expected =
      'sha256=' + createHmac('sha256', secret).update(req.rawBody).digest('hex');

    const a = Buffer.from(header);
    const b = Buffer.from(expected);
    // timingSafeEqual exige mismo largo y evita ataques por tiempo de respuesta.
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Firma inválida');
    }
    return true;
  }
}
