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

/** Un proveedor listo para usar, con cuánto se lo espera antes de pasar al siguiente. */
export interface LlmProviderEntry {
  /** Nombre para los logs (ej. el modelo). */
  name: string;
  provider: LlmProvider;
  /** Tiempo máximo de espera por cada respuesta de este proveedor. */
  timeoutMs: number;
}

/** Proveedores en orden de preferencia: si el primero falla, se intenta con el siguiente. Vacío = IA apagada. */
export const LLM_PROVIDERS = Symbol('LLM_PROVIDERS');
