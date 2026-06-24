// The real Clerk token verifier, used only when CLERK_SECRET_KEY is set (cloud).
// @clerk/backend is imported lazily so local dev / tests never need the package
// installed. Installed + wired at the deploy slice (A4).

export function clerkVerifier() {
  return async function verifyToken(token) {
    const { verifyToken: clerkVerify } = await import('@clerk/backend');
    return clerkVerify(token, { secretKey: process.env.CLERK_SECRET_KEY });
  };
}
