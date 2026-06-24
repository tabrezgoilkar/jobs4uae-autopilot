import { useEffect } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignIn, useAuth } from '@clerk/clerk-react';
import { setAuthTokenGetter } from './api';
import App from './App';

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;

// Registers Clerk's session-token getter so api.ts can authenticate /api calls.
function TokenBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setAuthTokenGetter(() => getToken());
    return () => setAuthTokenGetter(null);
  }, [getToken]);
  return null;
}

function SignInScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <SignIn routing="hash" />
    </div>
  );
}

// With a Clerk key → require sign-in (cloud). Without one → render the app directly
// (local dev; the server runs in its matching 'local' bypass mode).
export default function AuthGate() {
  if (!clerkKey) return <App />;
  return (
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      <SignedIn>
        <TokenBridge />
        <App />
      </SignedIn>
      <SignedOut>
        <SignInScreen />
      </SignedOut>
    </ClerkProvider>
  );
}
