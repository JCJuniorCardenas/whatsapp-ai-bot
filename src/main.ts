import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { isSwaggerEnabled } from './common/runtime-flags';

async function bootstrap() {
  // rawBody: true guarda el body sin parsear; lo necesitamos para validar la firma de Meta.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  // Detrás del proxy de Railway: así la IP real de cada pedido viene de X-Forwarded-For.
  // Sin esto el límite de pedidos vería a todo el mundo con la misma IP (la del proxy).
  app.set('trust proxy', 1);
  // Con esto, al apagar (ej. un deploy nuevo en Railway) se espera a terminar los mensajes en curso.
  app.enableShutdownHooks();

  if (isSwaggerEnabled(process.env)) {
    const config = new DocumentBuilder()
      .setTitle('WhatsApp AI Bot')
      .setDescription('Bot de WhatsApp para agendar turnos')
      .setVersion('0.1.0')
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  } else {
    new Logger('Bootstrap').log('Swagger desactivado (SWAGGER_ENABLED=true para publicarlo)');
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
