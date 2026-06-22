import { type ReactNode } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function AppShell({ engine, children }: { engine: string | null; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--canvas)' }}>
      <Sidebar engine={engine} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ maxWidth: 1040, margin: '0 auto', padding: '26px 28px 60px' }}>{children}</div>
        </main>
      </div>
    </div>
  );
}
