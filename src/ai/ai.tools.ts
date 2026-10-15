import { LlmTool } from './llm.types';

// Las herramientas que el modelo puede pedir. Ninguna modifica nada por sí sola:
// reservar y cancelar solo dejan una acción pendiente que la persona debe confirmar.
export const AI_TOOLS: LlmTool[] = [
  {
    name: 'get_availability',
    description:
      'Devuelve los horarios libres de un día. Usala siempre antes de ofrecer horarios; nunca los inventes.',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha en formato YYYY-MM-DD (hora argentina).' },
        part_of_day: {
          type: 'string',
          enum: ['morning', 'afternoon'],
          description: 'Opcional. morning = hasta 12:30, afternoon = desde 13:00.',
        },
      },
      required: ['date'],
    },
  },
  {
    name: 'request_booking',
    description:
      'Pide reservar un turno. NO lo reserva: valida el horario y deja la reserva esperando que la persona confirme con "sí".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD.' },
        time: { type: 'string', description: 'Hora HH:MM (24 hs), múltiplo de 30 minutos.' },
      },
      required: ['date', 'time'],
    },
  },
  {
    name: 'list_my_appointments',
    description: 'Lista los turnos futuros de la persona que está escribiendo.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'request_cancellation',
    description:
      'Pide cancelar un turno de la persona. NO lo cancela: queda esperando que confirme con "sí".',
    parameters: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'Fecha YYYY-MM-DD del turno.' },
        time: { type: 'string', description: 'Hora HH:MM del turno.' },
      },
      required: ['date', 'time'],
    },
  },
];
