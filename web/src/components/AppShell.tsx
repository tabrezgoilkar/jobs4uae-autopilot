import { useEffect, useState, type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import CommandPalette from './CommandPalette';
import CopilotPanel from './CopilotPanel';

export default function AppShell({ engine, children }: { engine: string | null; children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--canvas)' }}>
      <Sidebar engine={engine} open={navOpen} onClose={() => setNavOpen(false)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar onOpenPalette={() => setPaletteOpen(true)} onToggleCopilot={() => setCopilotOpen((v) => !v)} onOpenNav={() => setNavOpen(true)} />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div className="mx-auto px-4 md:px-7 py-6 md:py-[26px] pb-16" style={{ maxWidth: 1040 }}>{children}</div>
        </main>
      </div>
      <CopilotPanel open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
