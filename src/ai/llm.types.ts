// Tipos neutrales: el resto de la app no sabe qué proveedor de IA hay detrás.

export type LlmPart =
  | { type: 'text'; text: string }
  | {
      type: 'tool_call';
      name: string;
      args: Record<string, unknown>;
      /** Dato opaco del proveedor que hay que devolverle tal cual en el siguiente turno. */
      raw?: unknown;
    }
  | { type: 'tool_result'; name: string; result: Record<string, unknown> };

export interface LlmMessage {
  role: 'user' | 'model';
  parts: LlmPart[];
}

export interface LlmTool {
  name: string;
  description: string;
  /** JSON Schema de los parámetros. */
  parameters: Record<string, unknown>;
}

export interface LlmRequest {
  system: string;
  messages: LlmMessage[];
  tools: LlmTool[];
  maxOutputTokens: number;
}

export interface LlmProvider {
  /** Una vuelta al modelo: devuelve su próximo mensaje (texto y/o llamadas a herramientas). */
  complete(request: LlmRequest): Promise<LlmMessage>;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
