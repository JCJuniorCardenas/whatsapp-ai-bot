import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { AiService } from './ai.service';
import { GeminiProvider } from './gemini.provider';
import { LLM_PROVIDER } from './llm.types';

const DEFAULT_MODEL = 'gemini-3.8-flash';

@Module({
  imports: [AppointmentsModule, ContactsModule, MessagesModule],
  providers: [
    AiService,
    {
      // Sin GEMINI_API_KEY la IA queda apagada y el bot sigue andando con los comandos.
      provide: LLM_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('GEMINI_API_KEY');
        const logger = new Logger('AiModule');
        if (!apiKey) {
          logger.warn('GEMINI_API_KEY no está definida: la IA está desactivada');
          return null;
        }
        const model = config.get<string>('AI_MODEL') ?? DEFAULT_MODEL;
        logger.log(`IA activada con Gemini (${model})`);
        return new GeminiProvider(apiKey, model);
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
