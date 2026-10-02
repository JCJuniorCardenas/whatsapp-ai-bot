// Solo los campos del payload de Meta que usamos hoy.
export interface WhatsappMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
}

export interface WhatsappWebhookPayload {
  object?: string;
  entry?: {
    changes?: {
      value?: { messages?: WhatsappMessage[] };
    }[];
  }[];
}
