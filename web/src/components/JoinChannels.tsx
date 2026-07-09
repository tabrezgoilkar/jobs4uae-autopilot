// "Join my channel" community links shown in the app top bars (desktop Topbar +
// mobile app bar). Brand glyphs, open in a new tab. Update the URLs here in one
// place if the channels change.
const WHATSAPP_CHANNEL = 'https://whatsapp.com/channel/0029VbBVrNI0wajv1FB2s901';
const TELEGRAM_GROUP = 'https://t.me/uaejobsgroup';

function WhatsAppGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 2.1.55 4.15 1.6 5.96L2 22l4.25-1.11a9.9 9.9 0 0 0 5.79 1.84h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.75 14.16c-.24.68-1.4 1.3-1.94 1.34-.5.05-.98.23-3.3-.69-2.78-1.1-4.55-3.94-4.69-4.13-.14-.19-1.13-1.5-1.13-2.87 0-1.36.71-2.03.97-2.31.25-.28.55-.35.73-.35l.53.01c.17.01.4-.06.62.48.24.55.81 1.9.88 2.04.07.14.12.3.02.49-.1.19-.15.3-.29.47-.14.16-.3.36-.43.49-.14.14-.29.29-.12.57.17.28.75 1.24 1.61 2 1.11.99 2.05 1.3 2.34 1.44.29.14.46.12.63-.07.17-.19.72-.84.91-1.13.19-.28.38-.24.64-.14.26.09 1.66.78 1.94.93.29.14.48.21.55.33.07.12.07.68-.17 1.36z"/>
    </svg>
  );
}

function TelegramGlyph({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#229ED9" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.64 6.8-1.56 7.36c-.12.52-.42.65-.85.4l-2.35-1.73-1.13 1.09c-.13.13-.24.24-.48.24l.17-2.43 4.42-3.99c.19-.17-.04-.27-.3-.1l-5.46 3.44-2.35-.73c-.51-.16-.52-.51.11-.76l9.18-3.54c.42-.16.79.1.65.75z"/>
    </svg>
  );
}

// desktop: 34px square chips matching the Topbar buttons.
// mobile: 36px rounded chips matching the mobile app-bar buttons.
const VARIANT = {
  desktop: 'h-[34px] w-[34px] rounded-md border border-hair-subtle',
  mobile: 'w-9 h-9 rounded-[10px]',
} as const;

export default function JoinChannels({ variant = 'desktop' }: { variant?: 'desktop' | 'mobile' }) {
  const cls = `j4u-press inline-flex items-center justify-center ${VARIANT[variant]}`;
  const style = variant === 'mobile' ? { border: '1px solid var(--border-subtle)', background: 'var(--surface)' } : undefined;
  const size = variant === 'mobile' ? 18 : 17;
  return (
    <div className="flex items-center gap-1.5" aria-label="Join our channels">
      <a href={WHATSAPP_CHANNEL} target="_blank" rel="noopener noreferrer" aria-label="Join our WhatsApp channel" title="Join our WhatsApp channel" className={cls} style={style}>
        <WhatsAppGlyph size={size} />
      </a>
      <a href={TELEGRAM_GROUP} target="_blank" rel="noopener noreferrer" aria-label="Join our Telegram group" title="Join our Telegram group" className={cls} style={style}>
        <TelegramGlyph size={size} />
      </a>
    </div>
  );
}
