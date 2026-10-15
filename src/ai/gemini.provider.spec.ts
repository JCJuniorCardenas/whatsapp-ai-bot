import { fromGeminiPart, toGeminiContent } from './gemini.provider';
import { LlmMessage } from './llm.types';

describe('adaptador de Gemini', () => {
  it('traduce una llamada a herramienta y conserva la parte original (firma de pensamiento)', () => {
    const original = {
      functionCall: { name: 'get_availability', args: { date: '2026-10-20' } },
      thoughtSignature: 'firma-opaca',
    };
    const [part] = fromGeminiPart(original);
    expect(part).toMatchObject({ type: 'tool_call', name: 'get_availability', args: { date: '2026-10-20' } });

    const echoed = toGeminiContent({ role: 'model', parts: [part] });
    expect(echoed.parts?.[0]).toBe(original); // se devuelve idéntica
  });

  it('ignora las partes de pensamiento y las vacías', () => {
    expect(fromGeminiPart({ text: 'pensando…', thought: true })).toEqual([]);
    expect(fromGeminiPart({})).toEqual([]);
  });

  it('traduce texto y resultados de herramientas', () => {
    const message: LlmMessage = {
      role: 'user',
      parts: [
        { type: 'text', text: 'hola' },
        { type: 'tool_result', name: 'get_availability', result: { free_times: ['9:00'] } },
      ],
    };
    expect(toGeminiContent(message)).toEqual({
      role: 'user',
      parts: [
        { text: 'hola' },
        { functionResponse: { name: 'get_availability', response: { free_times: ['9:00'] } } },
      ],
    });
  });

  it('una llamada sin parte original se reconstruye', () => {
    const content = toGeminiContent({
      role: 'model',
      parts: [{ type: 'tool_call', name: 'list_my_appointments', args: {} }],
    });
    expect(content.parts?.[0]).toEqual({ functionCall: { name: 'list_my_appointments', args: {} } });
  });
});
