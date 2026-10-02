import { normalizeRecipient } from './normalize-phone';

describe('normalizeRecipient', () => {
  it('saca el 9 de los celulares argentinos', () => {
    expect(normalizeRecipient('5493772692892')).toBe('543772692892');
  });

  it('no toca números de otros países', () => {
    expect(normalizeRecipient('16315551181')).toBe('16315551181');
  });

  it('no toca números argentinos que ya no tienen el 9', () => {
    expect(normalizeRecipient('543772692892')).toBe('543772692892');
  });
});
