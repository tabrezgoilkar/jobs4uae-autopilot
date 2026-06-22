import type { ReactNode } from 'react';

export type Tone = 'success' | 'warning' | 'danger' | 'primary' | 'ai' | 'neutral' | 'info';

const TONE: Record<Tone, string> = {
  success: 'bg-success-soft text-success-text border-success-soft',
  warning: 'bg-warning-soft text-warning-text border-warning-soft',
  danger: 'bg-danger-soft text-danger-text border-danger-soft',
  info: 'bg-info-soft text-info-text border-info-soft',
  primary: 'bg-primary-50 text-primary-700 border-primary-100',
  ai: 'bg-ai-soft text-ai-700 border-ai-soft',
  neutral: 'bg-surface-sunken text-ink-secondary border-hair',
};

/** Small pill label. AI tone (iris) is reserved for AI affordances only. */
export default function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-semibold ${TONE[tone]} ${className}`}>
      {children}
    </span>
  );
}
