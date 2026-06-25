const COPY: Record<string, { title: string; body: string }> = {
  scan: { title: 'Scan GCC boards', body: 'Scanning drives a real browser, so it arrives as a desktop companion that pairs with your account.' },
  'auto-apply': { title: 'Auto-apply', body: 'Assisted apply opens a real browser you log into and submit yourself — coming as the desktop companion.' },
  tracker: { title: 'Tracker', body: 'Your application tracker is being brought online next.' },
};

export default function MobileComingSoon({ route }: { route: string }) {
  const c = COPY[route] ?? { title: 'Coming soon', body: 'This feature is on the way.' };
  return (
    <div className="j4u-rise flex flex-col items-center text-center" style={{ paddingTop: 56 }}>
      <span className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg,#F6F2FE,#EEF3FF)', border: '1px solid #E0D5FB' }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="#6B45F0"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>
      </span>
      <div className="mt-4 text-[16px] font-bold" style={{ color: 'var(--text-strong)' }}>{c.title} — coming soon</div>
      <p className="mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)', maxWidth: 300 }}>{c.body}</p>
    </div>
  );
}
