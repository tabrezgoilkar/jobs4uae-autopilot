import { useLocation } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import JoinChannels from './JoinChannels';
import { IconSparkle } from './icons';

// Per-route topbar copy. Matches the page intent in the approved design.
const META: Record<string, { title: string; sub: string }> = {
  '/': { title: 'Home', sub: 'Your job-search copilot' },
  '/profile': { title: 'My profile', sub: 'Your CV, skills and details' },
  '/evaluate': { title: 'Evaluate a job', sub: 'Honest A–F fit score' },
  '/documents': { title: 'Documents', sub: 'Tailored CVs & cover letters' },
  '/tracker': { title: 'Tracker', sub: 'Every application in one place' },
  '/scan': { title: 'Scan GCC boards', sub: 'Find roles across the Gulf' },
  '/auto-apply': { title: 'Auto-apply', sub: 'Assisted applications — you submit' },
  '/settings': { title: 'Settings', sub: 'AI engine, details & privacy' },
};

function metaFor(pathname: string) {
  if (META[pathname]) return META[pathname];
  // longest matching prefix
  const hit = Object.keys(META)
    .filter((p) => p !== '/' && pathname.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return hit ? META[hit] : { title: 'Jobs4UAE Autopilot', sub: '' };
}

export default function Topbar({
  onOpenPalette,
  onToggleCopilot,
  onOpenNav,
}: {
  onOpenPalette: () => void;
  onToggleCopilot: () => void;
  onOpenNav: () => void;
}) {
  const { pathname } = useLocation();
  const { title, sub } = metaFor(pathname);

  return (
    <header
      className="sticky top-0 z-10 flex items-center gap-2 sm:gap-3 px-4 md:px-7 py-3 border-b border-hair-subtle"
      style={{ background: 'color-mix(in srgb, var(--surface) 85%, transparent)', backdropFilter: 'blur(8px)' }}
    >
      {/* Mobile menu button */}
      <button type="button" onClick={onOpenNav} aria-label="Open menu" className="md:hidden -ml-1 p-1.5 text-ink-secondary">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
      </button>

      <div className="text-[15px] font-bold text-ink-strong truncate">{title}</div>
      {sub && <div className="hidden sm:block text-xs text-ink-muted truncate">{sub}</div>}

      <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
        {/* Join our community channels */}
        <JoinChannels variant="desktop" />
        <span className="hidden sm:block w-px h-5 bg-hair-subtle mx-0.5" />

        {/* ⌘K command palette — ask the UAE job market */}
        <button
          type="button"
          onClick={onOpenPalette}
          title="Ask the UAE job market (⌘K)"
          className="j4u-press hidden md:flex items-center gap-2 h-[34px] px-3 rounded-md text-xs text-ai-700 border border-ai-soft bg-ai-soft"
          style={{ width: 300 }}
        >
          <IconSparkle size={13} color="var(--ai-600)" />
          <span>Ask about the UAE job market…</span>
          <span className="ml-auto font-mono text-[10px] rounded border border-ai-soft px-1">⌘K</span>
        </button>

        {/* Copilot side panel */}
        <button
          type="button"
          onClick={onToggleCopilot}
          title="Career copilot (⌘J)"
          className="j4u-press inline-flex items-center gap-1.5 h-[34px] px-2.5 sm:px-3 rounded-md text-xs font-semibold text-ai-700 border border-ai-soft bg-ai-soft"
        >
          <IconSparkle size={13} color="var(--ai-600)" />
          <span>Copilot</span>
          <span className="hidden sm:inline font-mono text-[10px] opacity-70">⌘J</span>
        </button>

        <span className="hidden sm:block w-px h-5 bg-hair-subtle mx-0.5" />
        <ThemeToggle />
      </div>
    </header>
  );
}
