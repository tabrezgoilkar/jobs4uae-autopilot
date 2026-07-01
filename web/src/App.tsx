import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getConfig, ApiError, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import AppShell from './components/AppShell';
import Button from './components/ui/Button';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import EvaluatePage from './pages/EvaluatePage';
import DocumentsPage from './pages/DocumentsPage';
import TrackerPage from './pages/TrackerPage';
import ScanPage from './pages/ScanPage';
import AutoApplyPage from './pages/AutoApplyPage';
import SettingsPage from './pages/SettingsPage';
import ComingSoon from './pages/ComingSoon';
import { useIsMobile } from './mobile/useIsMobile';
import MobileApp from './mobile/MobileApp';

// In the deployed (cloud) build, browser-driven + not-yet-per-user features
// aren't functional — route them to a clear "coming soon" page, not a broken one.
const IS_CLOUD = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<null | 'auth' | 'server'>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    getConfig()
      .then(setConfig)
      // A 401 means the session was rejected (expired/unauthorized), not that the
      // server is unreachable — show a sign-in prompt instead of a "server down".
      .catch((e) => setError(e instanceof ApiError && e.status === 401 ? 'auth' : 'server'));
  }, []);

  if (error === 'auth') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Your session has expired or isn’t authorized. Please sign in again.</p>
        <Button type="button" onClick={() => window.location.reload()}>Sign in again</Button>
      </div>
    );
  }

  if (error === 'server') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center" style={{ color: 'var(--danger-text)' }}>
        Cannot reach the Jobs4UAE Autopilot server. Make sure it is running, then refresh this page.
      </div>
    );
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>;
  }

  if (!config.setupComplete) {
    return <SetupWizard initial={config} onComplete={setConfig} />;
  }

  // Phones get the dedicated mobile app; embedded pages still use router hooks.
  if (isMobile) {
    return (
      <BrowserRouter>
        <MobileApp config={config} />
      </BrowserRouter>
    );
  }

  return (
    <BrowserRouter>
      <AppShell engine={config.engine}>
        <Routes>
          <Route path="/" element={<Dashboard config={config} />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/evaluate" element={IS_CLOUD ? <ComingSoon title="Evaluate" kind="soon" /> : <EvaluatePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/tracker" element={IS_CLOUD ? <ComingSoon title="Tracker" kind="soon" /> : <TrackerPage />} />
          <Route path="/scan" element={IS_CLOUD ? <ComingSoon title="Scan GCC boards" kind="companion" /> : <ScanPage />} />
          <Route path="/auto-apply" element={IS_CLOUD ? <ComingSoon title="Auto-apply" kind="companion" /> : <AutoApplyPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
