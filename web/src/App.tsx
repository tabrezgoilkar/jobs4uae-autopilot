import { useEffect, useState } from 'react';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import Home from './pages/Home';

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

  return config.setupComplete ? (
    <Home config={config} />
  ) : (
    <SetupWizard initial={config} onComplete={setConfig} />
  );
}
