import { useEffect, useRef, useState } from 'react';

/** Eased count-up for headline numbers. Respects prefers-reduced-motion. */
export function useCountUp(target: number, ms = 900): number {
  const [v, setV] = useState(target);
  const prev = useRef(0);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    // Intentional one-time sync: snap straight to the target when motion is reduced (not a render loop).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (reduce) { setV(target); return; }
    const from = prev.current;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - t, 3);
      setV(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
