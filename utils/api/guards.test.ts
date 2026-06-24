import { describe, expect, it, vi, beforeEach } from 'vitest';
import { jsonError, getClientIp, assertSameOrigin, requireCsrf, toErrorResponse } from './guards';

function mockRequest(overrides: Record<string, unknown> = {}) {
  const headers = new Map<string, string>();
  const setHeader = (k: string, v: string) => headers.set(k.toLowerCase(), v);
  return {
    url: 'http://localhost:3000/api/test',
    headers: {
      get: (k: string) => headers.get(k.toLowerCase()) ?? null,
      forEach: () => {},
    },
    cookies: {
      get: (k: string) => {
        const v = headers.get(`cookie:${k}`);
        return v ? { value: v } : undefined;
      },
    },
    method: 'POST',
    json: async () => ({}),
    ...overrides,
    setHeader,
  } as any;
}

describe('jsonError', () => {
  it('returns response with default status 500', async () => {
    const res = jsonError('boom');
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'boom' });
  });

  it('returns response with custom status', async () => {
    const res = jsonError('not found', 404);
    expect(res.status).toBe(404);
  });
});

describe('getClientIp', () => {
  it('returns x-forwarded-for last IP (most trustworthy)', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => k === 'x-forwarded-for' ? '10.0.0.1, 10.0.0.2' : null;
    expect(getClientIp(req as any)).toBe('10.0.0.2');
  });

  it('prefers x-real-ip over x-forwarded-for', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => {
      if (k === 'x-real-ip') return '10.0.0.5';
      if (k === 'x-forwarded-for') return '10.0.0.1';
      return null;
    };
    expect(getClientIp(req as any)).toBe('10.0.0.5');
  });

  it('falls back to x-real-ip', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => k === 'x-real-ip' ? '10.0.0.5' : null;
    expect(getClientIp(req as any)).toBe('10.0.0.5');
  });

  it('returns unknown when no headers present', () => {
    const req = mockRequest();
    req.headers.get = () => null;
    expect(getClientIp(req as any)).toBe('unknown');
  });
});

describe('assertSameOrigin', () => {
  it('passes when origin matches request URL', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => k === 'origin' ? 'http://localhost:3000' : null;
    expect(() => assertSameOrigin(req as any)).not.toThrow();
  });

  it('throws when origin does not match', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => k === 'origin' ? 'http://evil.com' : null;
    expect(() => assertSameOrigin(req as any)).toThrow();
  });

  it('passes when origin is absent (same-origin request)', () => {
    const req = mockRequest();
    req.headers.get = () => null;
    expect(() => assertSameOrigin(req as any)).not.toThrow();
  });
});

describe('requireCsrf', () => {
  it('passes when header token matches cookie token', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => {
      if (k === 'origin') return 'http://localhost:3000';
      if (k === 'x-csrf-token') return 'abc123';
      return null;
    };
    req.cookies.get = (k: string) => k === 'csrf-token' ? { value: 'abc123' } : undefined;
    expect(() => requireCsrf(req as any)).not.toThrow();
  });

  it('throws when header token does not match cookie token', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => {
      if (k === 'origin') return 'http://localhost:3000';
      if (k === 'x-csrf-token') return 'abc123';
      return null;
    };
    req.cookies.get = (k: string) => k === 'csrf-token' ? { value: 'def456' } : undefined;
    expect(() => requireCsrf(req as any)).toThrow();
  });

  it('passes when no origin header (same-orient request)', () => {
    const req = mockRequest();
    req.headers.get = (k: string) => k === 'x-csrf-token' ? 'abc123' : null;
    req.cookies.get = () => undefined;
    expect(() => requireCsrf(req as any)).not.toThrow();
  });
});

describe('toErrorResponse', () => {
  it('passes through Response instances', () => {
    const res = new Response('test', { status: 403 });
    expect(toErrorResponse(res)).toBe(res);
  });

  it('returns generic 500 for unknown errors', async () => {
    const res = toErrorResponse(new Error('oops'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'Request failed' });
  });
});
