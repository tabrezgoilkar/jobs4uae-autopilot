import { useState } from 'react';
import { getTheme, setTheme, type Theme } from '../theme/theme';
import { IconSun, IconMoon } from './icons';

export default function ThemeToggle() {
  const [theme, setT] = useState<Theme>(getTheme());

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    setT(next);
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, borderRadius: 8,
        border: '1px solid var(--border)', background: 'var(--surface)',
        color: 'var(--text-secondary)', cursor: 'pointer',
      }}
    >
      {theme === 'dark' ? <IconSun size={17} /> : <IconMoon size={17} />}
    </button>
  );
}
