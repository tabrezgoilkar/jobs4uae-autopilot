import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ProfilePage from './pages/ProfilePage';
import EvaluatePage from './pages/EvaluatePage';
import DocumentsPage from './pages/DocumentsPage';
import TrackerPage from './pages/TrackerPage';
import ScanPage from './pages/ScanPage';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center text-red-600">
        Cannot reach the Jobs4UAE Autopilot server. Make sure it is running, then refresh this page.
      </div>
    );
  }

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  }

  if (!config.setupComplete) {
    return <SetupWizard initial={config} onComplete={setConfig} />;
  }

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard config={config} />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/evaluate" element={<EvaluatePage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/tracker" element={<TrackerPage />} />
          <Route path="/scan" element={<ScanPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
