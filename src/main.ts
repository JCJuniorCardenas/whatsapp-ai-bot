import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true guarda el body sin parsear; lo necesitamos para validar la firma de Meta.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  // Con esto, al apagar (ej. un deploy nuevo en Railway) se espera a terminar los mensajes en curso.
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('WhatsApp AI Bot')
    .setDescription('Bot de WhatsApp para agendar turnos')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
