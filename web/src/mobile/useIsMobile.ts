import { useEffect, useState } from 'react';

// True on phone-width viewports. The app renders the dedicated mobile UI below
// this breakpoint and the desktop shell above it.
export function useIsMobile(breakpoint = 768): boolean {
  const get = () => (typeof window !== 'undefined' ? window.innerWidth < breakpoint : false);
  const [isMobile, setIsMobile] = useState(get);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const on = () => setIsMobile(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [breakpoint]);
  return isMobile;
}
