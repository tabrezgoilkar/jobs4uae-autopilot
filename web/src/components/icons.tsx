import type { SVGProps } from 'react';

type P = { size?: number };

function base(size = 18): SVGProps<SVGSVGElement> {
  return {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round',
  };
}

export function IconHome({ size }: P) {
  return (<svg {...base(size)}><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>);
}
export function IconUser({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>);
}
export function IconTarget({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /></svg>);
}
export function IconDoc({ size }: P) {
  return (<svg {...base(size)}><path d="M14 3H6v18h12V8z" /><path d="M14 3v5h5" /></svg>);
}
export function IconBars({ size }: P) {
  return (<svg {...base(size)}><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="11" rx="1" /><rect x="17" y="4" width="4" height="7" rx="1" /></svg>);
}
export function IconSearch({ size }: P) {
  return (<svg {...base(size)}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>);
}
export function IconSend({ size }: P) {
  return (<svg {...base(size)}><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4z" /></svg>);
}
export function IconSun({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>);
}
export function IconMoon({ size }: P) {
  return (<svg {...base(size)}><path d="M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z" /></svg>);
}
export function IconSparkle({ size = 13, color = 'currentColor' }: { size?: number; color?: string }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24"><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={color} /></svg>);
}
export function IconSettings({ size }: P) {
  return (<svg {...base(size)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 14H4.5a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 6 8.6a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 10 4.6h.09A1.65 1.65 0 0 0 11 2.5a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 10v.09a2 2 0 0 1 0 4z" /></svg>);
}
