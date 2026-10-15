import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThinkingLevel } from '@google/genai';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { AiService } from './ai.service';
import { GeminiProvider } from './gemini.provider';
import { LLM_PROVIDER } from './llm.types';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

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
        const thinking = (config.get<string>('AI_THINKING_LEVEL') ?? 'LOW').toUpperCase();
        // 'NONE' lo omite, para modelos que no aceptan el parámetro.
        const level = thinking === 'NONE' ? undefined : (thinking as ThinkingLevel);
        logger.log(`IA activada con Gemini (${model}, pensamiento ${level ?? 'por defecto'})`);
        return new GeminiProvider(apiKey, model, level);
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
