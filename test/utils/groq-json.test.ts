import { describe, expect, it } from 'vitest';
import { extractJson } from '../../utils/api/groq';

describe('extractJson', () => {
  it('parses a plain JSON object', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('unwraps a fenced code block', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('survives a raw newline inside a string', () => {
    // The bug this exists for: a model put a literal line break inside one
    // section's prose, JSON.parse rejected the entire document, and a whole
    // report's narration was silently discarded for the fallback.
    const raw = '{"progress":"Two items completed.\nDelivered: guidelines."}';
    expect(extractJson(raw)).toEqual({
      progress: 'Two items completed.\nDelivered: guidelines.',
    });
  });

  it('survives raw tabs and carriage returns too', () => {
    expect(extractJson('{"a":"x\ty\r\nz"}')).toEqual({ a: 'x\ty\r\nz' });
  });

  it('leaves already-escaped sequences alone', () => {
    expect(extractJson('{"a":"line\\nbreak"}')).toEqual({ a: 'line\nbreak' });
  });

  it('does not treat an escaped quote as the end of a string', () => {
    // Getting this wrong would flip the in-string state and start escaping
    // the JSON's own structure.
    expect(extractJson('{"a":"he said \\"hi\\"","b":2}')).toEqual({ a: 'he said "hi"', b: 2 });
  });

  it('leaves whitespace between tokens untouched', () => {
    expect(extractJson('{\n  "a": 1,\n  "b": 2\n}')).toEqual({ a: 1, b: 2 });
  });

  it('still throws on genuinely broken JSON', () => {
    expect(() => extractJson('{"a": }')).toThrow();
  });
});
