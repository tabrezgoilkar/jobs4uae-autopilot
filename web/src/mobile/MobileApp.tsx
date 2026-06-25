import { useState } from 'react';
import type { AppConfig } from '../api';
import { MobileCopilotSheet, MobileAskSheet } from './MobileSheets';
import MobileHome from './MobileHome';
import MobileProfile from './MobileProfile';
import MobileDocuments from './MobileDocuments';
import MobileSettings from './MobileSettings';
import MobileComingSoon from './MobileComingSoon';

export type MobileRoute = 'home' | 'scan' | 'tracker' | 'documents' | 'auto-apply' | 'profile' | 'settings';

const TABS: { route: MobileRoute; label: string; icon: React.ReactNode }[] = [
  { route: 'home', label: 'Home', icon: <path d="M3 11l9-8 9 8M5 10v10h14V10" /> },
  { route: 'scan', label: 'Scan', icon: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></> },
  { route: 'tracker', label: 'Tracker', icon: <><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /></> },
  { route: 'documents', label: 'Docs', icon: <><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /></> },
  { route: 'auto-apply', label: 'Apply', icon: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></> },
];

const TITLES: Record<MobileRoute, string> = {
  home: '', scan: 'Scan GCC boards', tracker: 'Tracker', documents: 'Documents',
  'auto-apply': 'Auto-apply', profile: 'My profile', settings: 'Settings',
};

function Sparkle({ size = 16, color = '#6B45F0' }: { size?: number; color?: string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>;
}

export default function MobileApp({ config }: { config: AppConfig }) {
  const [route, setRoute] = useState<MobileRoute>('home');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);

  const go = (r: MobileRoute) => { setRoute(r); window.scrollTo?.(0, 0); };
  // Scan / Tracker / Auto-apply aren't in the mobile build yet (browser features →
  // desktop companion); show the on-brand coming-soon screen.
  const comingSoon = route === 'scan' || route === 'tracker' || route === 'auto-apply';
  const showBack = route === 'profile' || route === 'settings';

  return (
    <div className="flex flex-col" style={{ height: '100dvh', background: 'var(--canvas)' }}>
      {/* top app bar */}
      <header className="flex-none flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)' }}>
        {showBack ? (
          <button onClick={() => go('home')} aria-label="Back" className="j4u-press -ml-1 w-9 h-9 flex items-center justify-center rounded-[9px]" style={{ color: 'var(--text-strong)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        ) : route === 'home' ? (
          <span className="relative text-[18px] font-semibold tracking-tight" style={{ color: 'var(--text-strong)' }}>jobs4uae<span className="absolute" style={{ left: 10, top: -11 }}><Sparkle size={11} /></span></span>
        ) : (
          <span className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--text-strong)' }}>{TITLES[route]}</span>
        )}
        <span className="ml-auto flex items-center gap-2">
          <button onClick={() => setPaletteOpen(true)} aria-label="Ask the market" className="j4u-press w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ border: '1px solid #E0D5FB', background: 'var(--ai-soft)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B45F0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>
          </button>
          <button onClick={() => setCopilotOpen(true)} aria-label="Copilot" className="j4u-press w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ border: '1px solid #E0D5FB', background: 'var(--ai-soft)' }}><Sparkle /></button>
          <button onClick={() => go('profile')} aria-label="Profile" className="j4u-press w-9 h-9 rounded-full flex items-center justify-center text-[12.5px] font-bold" style={{ background: 'var(--primary-100)', color: 'var(--primary-700)' }}>
            {(config.engine ? 'AI' : 'J4')}
          </button>
        </span>
      </header>

      {/* scroll area */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-4 pt-4" style={{ paddingBottom: 96 }}>
          {route === 'home' && <MobileHome go={go} />}
          {route === 'profile' && <MobileProfile onOpenSettings={() => go('settings')} />}
          {route === 'documents' && <MobileDocuments />}
          {route === 'settings' && <MobileSettings />}
          {comingSoon && <MobileComingSoon route={route} />}
        </div>
      </main>

      {/* bottom tab bar */}
      <nav className="flex-none flex items-stretch border-t" style={{ background: 'var(--surface)', borderColor: 'var(--border-subtle)', padding: '6px 6px 18px' }}>
        {TABS.map((t) => {
          const active = route === t.route;
          return (
            <button key={t.route} onClick={() => go(t.route)} className="j4u-press flex-1 flex flex-col items-center gap-[3px] py-1.5" style={{ color: active ? 'var(--primary-700)' : 'var(--text-muted)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              <span className="text-[10px]" style={{ fontWeight: active ? 700 : 500 }}>{t.label}</span>
            </button>
          );
        })}
      </nav>

      {paletteOpen && <MobileAskSheet onClose={() => setPaletteOpen(false)} />}
      {copilotOpen && <MobileCopilotSheet onClose={() => setCopilotOpen(false)} />}
    </div>
  );
}
