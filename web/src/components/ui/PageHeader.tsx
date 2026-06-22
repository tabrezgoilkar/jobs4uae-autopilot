import type { ReactNode } from 'react';

/** Page intro: bold title + optional subtitle, with an optional right-aligned action. */
export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink-strong">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-secondary">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
