import { describe, expect, it } from 'vitest';
import { pickExtractionModel } from '../../utils/api/groq';

describe('pickExtractionModel', () => {
  it('routes short text logs to the 8B instant model', () => {
    expect(pickExtractionModel('Paid R850 for fuel', 'text')).toBe('llama-3.1-8b-instant');
  });

  it('routes long text to the 70B model', () => {
    expect(pickExtractionModel('x'.repeat(300), 'text')).toBe('llama-3.3-70b-versatile');
  });

  it('always routes file logs to the 70B model', () => {
    expect(pickExtractionModel('short', 'file')).toBe('llama-3.3-70b-versatile');
  });
});
