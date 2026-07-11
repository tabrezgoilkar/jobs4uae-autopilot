import type { ReactElement } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconHome, IconUser, IconDoc, IconBars, IconSearch, IconSend, IconSparkle, IconSettings } from './icons';

// In the cloud build, hide features that aren't online yet (Tracker, Scan,
// Auto-apply need per-user data / a real browser — see Phase B). Detected by the
// presence of the Clerk key, which is only set on the deployed app.
const IS_CLOUD = !!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const WORKSPACE = [
  { to: '/', label: 'Home', Icon: IconHome },
  { to: '/profile', label: 'My profile', Icon: IconUser },
  { to: '/documents', label: 'Documents', Icon: IconDoc },
  { to: '/tracker', label: 'Tracker', Icon: IconBars, cloud: false },
] as const;

// Cloud-safe pages (no browser / per-user data the cloud build lacks).
const CLOUD_PAGES = [
  { to: '/evaluate', label: 'Evaluate', Icon: IconSparkle },
  { to: '/scan', label: 'Scan GCC boards', Icon: IconSearch },
  { to: '/upskill', label: 'Upskill plan', Icon: IconBars },
  { to: '/auto-apply', label: 'Auto-apply', Icon: IconSend },
] as const;

const FIND_APPLY = [
  { to: '/scan', label: 'Scan GCC boards', Icon: IconSearch },
  { to: '/auto-apply', label: 'Auto-apply', Icon: IconSend },
] as const;

function NavItem({ to, label, Icon, active, onNavigate }: { to: string; label: string; Icon: (p: { size?: number }) => ReactElement; active: boolean; onNavigate: () => void }) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="j4u-nav"
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 8,
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
}

export default function Sidebar({ engine, open = false, onClose }: { engine: string | null; open?: boolean; onClose?: () => void }) {
  const { pathname } = useLocation();
  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(to + '/'));
  const closeOnMobile = () => onClose?.();

  return (
    <>
      {/* Mobile scrim */}
      {open && <div onClick={onClose} className="md:hidden fixed inset-0 z-40" style={{ background: 'var(--scrim)' }} aria-hidden="true" />}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[240px] flex-none flex flex-col transition-transform duration-200 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: 'var(--surface)', borderRight: '1px solid var(--border-subtle)', padding: '16px 12px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, fontWeight: 600, color: 'var(--text-strong)' }}>
            <span style={{ position: 'relative', fontSize: 20, letterSpacing: '-0.015em' }}>
              jobs4uae
              <span style={{ position: 'absolute', left: 11, top: -12 }}><IconSparkle size={12} color="var(--ai-600)" /></span>
            </span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>autopilot</span>
          </div>
          <button onClick={onClose} aria-label="Close menu" className="md:hidden text-ink-muted px-1" style={{ fontSize: 18 }}>✕</button>
        </div>

        <nav aria-label="Main" style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {WORKSPACE.filter((i) => !(IS_CLOUD && 'cloud' in i && i.cloud === false)).map(({ to, label, Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} active={isActive(to)} onNavigate={closeOnMobile} />
          ))}
          {!IS_CLOUD && (
            <>
              <div style={{ margin: '12px 10px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Find &amp; apply</div>
              {FIND_APPLY.map(({ to, label, Icon }) => (
                <NavItem key={to} to={to} label={label} Icon={Icon} active={isActive(to)} onNavigate={closeOnMobile} />
              ))}
            </>
          )}
          {IS_CLOUD && CLOUD_PAGES.map(({ to, label, Icon }) => (
            <NavItem key={to} to={to} label={label} Icon={Icon} active={isActive(to)} onNavigate={closeOnMobile} />
          ))}
          <div style={{ margin: '12px 10px 6px', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Workspace</div>
          <NavItem to="/settings" label="Settings" Icon={IconSettings} active={isActive('/settings')} onNavigate={closeOnMobile} />
        </nav>

        <div style={{ marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 4px 4px' }}>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--primary-100)', color: 'var(--primary-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>J4</div>
          <div style={{ lineHeight: 1.25, flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-strong)' }}>Your workspace</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{engine ? `AI · ${engine}` : 'AI not set up'}</div>
          </div>
          {engine && <span title="AI connected" style={{ width: 7, height: 7, flex: 'none', borderRadius: '50%', background: 'var(--success)' }} />}
        </div>
      </aside>
    </>
  );
}
