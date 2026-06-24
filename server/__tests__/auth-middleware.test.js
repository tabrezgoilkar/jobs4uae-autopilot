import { describe, it, expect, afterEach, vi } from 'vitest';
import { authMiddleware } from '../auth/middleware.js';

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

const ORIGINAL = process.env.CLERK_SECRET_KEY;
const ORIGINAL_ENV = process.env.NODE_ENV;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CLERK_SECRET_KEY;
  else process.env.CLERK_SECRET_KEY = ORIGINAL;
  process.env.NODE_ENV = ORIGINAL_ENV;
});

describe('authMiddleware', () => {
  it('dev bypass: with no CLERK_SECRET_KEY, sets userId=local and continues', async () => {
    delete process.env.CLERK_SECRET_KEY;
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware()(req, res, next);
    expect(req.userId).toBe('local');
    expect(next).toHaveBeenCalledOnce();
  });

  it('fails CLOSED in production when CLERK_SECRET_KEY is missing (no silent bypass)', async () => {
    delete process.env.CLERK_SECRET_KEY;
    process.env.NODE_ENV = 'production';
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware()(req, res, next);
    expect(res.statusCode).toBe(500);
    expect(req.userId).toBeUndefined();
    expect(next).not.toHaveBeenCalled();
  });

  it('treats an empty/whitespace CLERK_SECRET_KEY as unset', async () => {
    process.env.CLERK_SECRET_KEY = '   ';
    process.env.NODE_ENV = 'test';
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware()(req, res, next);
    expect(req.userId).toBe('local'); // dev bypass, not a broken verify path
    expect(next).toHaveBeenCalledOnce();
  });

  it('401s when Clerk is configured but no token is presented', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    const req = { headers: {} };
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware({ verifyToken: async () => ({ sub: 'x' }) })(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('sets userId from a verified token', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    const req = { headers: { authorization: 'Bearer good.token' } };
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware({ verifyToken: async (t) => { expect(t).toBe('good.token'); return { sub: 'user_42' }; } })(req, res, next);
    expect(req.userId).toBe('user_42');
    expect(next).toHaveBeenCalledOnce();
  });

  it('401s when the token fails verification', async () => {
    process.env.CLERK_SECRET_KEY = 'sk_test';
    const req = { headers: { authorization: 'Bearer bad' } };
    const res = mockRes();
    const next = vi.fn();
    await authMiddleware({ verifyToken: async () => { throw new Error('bad token'); } })(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
