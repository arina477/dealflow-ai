import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('parses a valid ok response', () => {
    const result = healthResponseSchema.parse({
      status: 'ok',
      db: 'ok',
      version: '1.0.0',
    });
    expect(result.status).toBe('ok');
    expect(result.db).toBe('ok');
    expect(result.version).toBe('1.0.0');
  });

  it('parses a valid degraded response', () => {
    const result = healthResponseSchema.parse({
      status: 'degraded',
      db: 'down',
      version: '1.0.0',
    });
    expect(result.status).toBe('degraded');
    expect(result.db).toBe('down');
  });

  it('rejects a bad status value', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'unknown',
        db: 'ok',
        version: '1.0.0',
      })
    ).toThrow();
  });

  it('rejects a missing version field', () => {
    expect(() =>
      healthResponseSchema.parse({
        status: 'ok',
        db: 'ok',
      })
    ).toThrow();
  });
});
