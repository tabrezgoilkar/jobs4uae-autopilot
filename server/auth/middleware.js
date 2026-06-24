// Identifies the signed-in user on every API request and sets req.userId, which
// the stores use to isolate data. Two modes:
//   - Cloud: CLERK_SECRET_KEY set → verify the bearer token → userId (Clerk's sub).
//   - Local dev: no CLERK_SECRET_KEY → userId = 'local' (no login needed), so the
//     owner's machine keeps working exactly as before.
//
// verifyToken is injected (the real Clerk verifier is wired in app.js) so this is
// unit-testable without the Clerk SDK or a network.

export function authMiddleware({ verifyToken } = {}) {
  return async function auth(req, res, next) {
    const hasClerk = process.env.CLERK_SECRET_KEY?.trim();
    if (!hasClerk) {
      // Fail CLOSED in production — never silently downgrade to a shared 'local'
      // account because a secret is missing. The bypass is a dev-only convenience.
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'Server authentication is misconfigured.' });
      }
      req.userId = 'local';
      return next();
    }
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    if (!token) return res.status(401).json({ error: 'Sign in required.' });
    try {
      const claims = await verifyToken(token);
      if (!claims?.sub) throw new Error('No subject in token.');
      req.userId = claims.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired session.' });
    }
  };
}
