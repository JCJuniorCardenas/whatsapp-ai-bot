import { ThinkingLevel } from '@google/genai';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ContactsModule } from '../contacts/contacts.module';
import { MessagesModule } from '../messages/messages.module';
import { buildProviderEntries } from './ai-providers';
import { AiService } from './ai.service';
import { GeminiProvider } from './gemini.provider';
import { LLM_PROVIDERS } from './llm.types';

@Module({
  imports: [AppointmentsModule, ContactsModule, MessagesModule],
  providers: [
    AiService,
    {
      // Sin GEMINI_API_KEY la lista queda vacía: la IA se apaga y el bot sigue andando con los comandos.
      provide: LLM_PROVIDERS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const logger = new Logger('AiModule');
        const apiKey = config.get<string>('GEMINI_API_KEY') as string;
        const thinking = (config.get<string>('AI_THINKING_LEVEL') ?? 'LOW').toUpperCase();
        // 'NONE' lo omite, para modelos que no aceptan el parámetro.
        const level = thinking === 'NONE' ? undefined : (thinking as ThinkingLevel);

        const entries = buildProviderEntries(
          (key) => config.get<string>(key),
          (model) => new GeminiProvider(apiKey, model, level),
        );
        if (entries.length === 0) {
          logger.warn('GEMINI_API_KEY no está definida: la IA está desactivada');
        } else {
          logger.log(
            `IA activada con Gemini: ${entries.map((e) => `${e.name} (${e.timeoutMs / 1000} s)`).join(' → ')}, pensamiento ${level ?? 'por defecto'}`,
          );
        }
        return entries;
      },
    },
  ],
  exports: [AiService],
})
export class AiModule {}
