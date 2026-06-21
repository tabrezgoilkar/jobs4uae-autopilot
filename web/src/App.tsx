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
          <Route path="/evaluate" element={<EvaluatePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/scan" element={<ScanPage />} />
          <Route path="/auto-apply" element={<AutoApplyPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
