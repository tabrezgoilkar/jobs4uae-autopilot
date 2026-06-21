import { Link, useLocation } from 'react-router-dom';
import { IconHome, IconUser, IconTarget, IconDoc, IconBars, IconSearch, IconSend, IconSparkle } from './icons';

const NAV = [
  { to: '/', label: 'Home', Icon: IconHome },
  { to: '/profile', label: 'My profile', Icon: IconUser },
  { to: '/evaluate', label: 'Evaluate a job', Icon: IconTarget },
  { to: '/documents', label: 'Documents', Icon: IconDoc },
  { to: '/tracker', label: 'Tracker', Icon: IconBars },
  { to: '/scan', label: 'Find jobs', Icon: IconSearch },
  { to: '/auto-apply', label: 'Auto-apply', Icon: IconSend },
] as const;

export default function Sidebar({ engine }: { engine: string | null }) {
  const { pathname } = useLocation();
  return (
    <aside style={{ width: 232, flex: 'none', background: 'var(--surface)', borderRight: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', padding: '18px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px 18px', fontWeight: 600, color: 'var(--text-strong)' }}>
        <span style={{ position: 'relative', fontSize: 21, letterSpacing: '-0.015em' }}>
          jobs4uae
          <span style={{ position: 'absolute', left: 11, top: -13 }}><IconSparkle size={13} color="var(--ai-600)" /></span>
        </span>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', padding: '0 8px 8px' }}>Workspace</div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ to, label, Icon }) => {
          const active = to === '/' ? pathname === '/' : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className="j4u-nav"
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                fontSize: 13.5, textDecoration: 'none',
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--primary-700)' : 'var(--text-secondary)',
                background: active ? 'var(--primary-50)' : 'transparent',
              }}
            >
              <Icon size={17} />
              {label}
            </Link>
          );
        })}
      </nav>
      <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>J4</div>
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' }}>Your workspace</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{engine ? `AI · ${engine}` : 'AI'}</div>
        </div>
      </div>
    </aside>
  );
}
