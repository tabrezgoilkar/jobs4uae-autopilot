import { useEffect, useState } from 'react';
import { getConfig, type AppConfig } from './api';
import SetupWizard from './pages/SetupWizard';
import Home from './pages/Home';

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    getConfig().then(setConfig);
  }, []);

  if (!config) {
    return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  }

  return config.setupComplete ? (
    <Home config={config} />
  ) : (
    <SetupWizard initial={config} onComplete={setConfig} />
  );
}
