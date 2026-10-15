import { Content, FunctionCallingConfigMode, GoogleGenAI, Part } from '@google/genai';
import { LlmMessage, LlmPart, LlmProvider, LlmRequest } from './llm.types';

/** Adaptador de Gemini (SDK oficial @google/genai) a la interfaz neutral de la app. */
export class GeminiProvider implements LlmProvider {
  private readonly ai: GoogleGenAI;

  constructor(
    apiKey: string,
    private readonly model: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  async complete(request: LlmRequest): Promise<LlmMessage> {
    const response = await this.ai.models.generateContent({
      model: this.model,
      contents: request.messages.map(toGeminiContent),
      config: {
        systemInstruction: request.system,
        maxOutputTokens: request.maxOutputTokens,
        tools: [
          {
            functionDeclarations: request.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parametersJsonSchema: t.parameters,
            })),
          },
        ],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO } },
      },
    });

    const parts = response.candidates?.[0]?.content?.parts ?? [];
    return { role: 'model', parts: parts.flatMap(fromGeminiPart) };
  }
}

export function toGeminiContent(message: LlmMessage): Content {
  return {
    role: message.role,
    parts: message.parts.map((part): Part => {
      switch (part.type) {
        case 'text':
          return { text: part.text };
        case 'tool_call':
          // Se devuelve la parte original: Gemini 3 exige conservar su firma de pensamiento.
          return (part.raw as Part | undefined) ?? { functionCall: { name: part.name, args: part.args } };
        case 'tool_result':
          return { functionResponse: { name: part.name, response: part.result } };
      }
    }),
  };
}

export function fromGeminiPart(part: Part): LlmPart[] {
  if (part.functionCall?.name) {
    return [
      {
        type: 'tool_call',
        name: part.functionCall.name,
        args: (part.functionCall.args ?? {}) as Record<string, unknown>,
        raw: part,
      },
    ];
  }
  // Las partes de "pensamiento" del modelo no son parte de la respuesta.
  if (part.text && !part.thought) return [{ type: 'text', text: part.text }];
  return [];
}
