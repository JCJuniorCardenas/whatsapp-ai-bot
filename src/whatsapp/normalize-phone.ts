/**
 * Meta entrega los celulares argentinos como 549XXXXXXXXXX (con el 9),
 * pero la lista de destinatarios de prueba los guarda como 54XXXXXXXXXX.
 * Para responder hay que sacar ese 9; si no, Graph API devuelve el error 131030.
 */
export function normalizeRecipient(phone: string): string {
  if (/^549\d{10}$/.test(phone)) {
    return '54' + phone.slice(3);
  }
  return phone;
}
