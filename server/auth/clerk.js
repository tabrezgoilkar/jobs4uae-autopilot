// The real Clerk token verifier, used only when CLERK_SECRET_KEY is set (cloud).
// @clerk/backend is imported lazily so local dev / tests never need the package
// installed. Installed + wired at the deploy slice (A4).

export function clerkVerifier() {
  return async function verifyToken(token) {
    const { verifyToken: clerkVerify } = await import('@clerk/backend');
    // authorizedParties pins accepted token origins (defends against tokens minted
    // for a different app). Set CLERK_AUTHORIZED_PARTIES to the prod frontend
    // origin(s), comma-separated. Required in production (asserted at startup).
    const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return clerkVerify(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
      ...(authorizedParties.length ? { authorizedParties } : {}),
    });
  };
}
