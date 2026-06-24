import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import AppShell from './components/AppShell';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import EvaluatePage from './pages/EvaluatePage';
import DocumentsPage from './pages/DocumentsPage';
import TrackerPage from './pages/TrackerPage';
import ScanPage from './pages/ScanPage';
import AutoApplyPage from './pages/AutoApplyPage';
import SettingsPage from './pages/SettingsPage';
import ComingSoon from './pages/ComingSoon';

// In the deployed (cloud) build, browser-driven + not-yet-per-user features
// aren't functional — route them to a clear "coming soon" page, not a broken one.
const IS_CLOUD = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError(true));
  }, []);

  if (error) {
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
