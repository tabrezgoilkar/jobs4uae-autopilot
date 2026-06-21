import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import ThemeToggle from './ThemeToggle';

export default function AppShell({ engine, children }: { engine: string | null; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--canvas)' }}>
      <Sidebar engine={engine} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px', background: 'var(--surface)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThemeToggle />
          </div>
        </header>
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <div style={{ maxWidth: 1040, margin: '0 auto' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
