import type { ReactNode } from 'react';

/**
 * Lumzi surface card: hairline border, soft shadow, 14px radius.
 * Optional header row (title + optional action) above a padded body.
 */
export default function Card({
  title,
  action,
  children,
  padding = true,
  className = '',
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padding?: boolean;
  className?: string;
}) {
  return (
    <div className={`bg-surface border border-hair-subtle rounded-md shadow-sm overflow-hidden ${className}`}>
      {title !== undefined && (
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hair-subtle">
          <div className="text-sm font-semibold text-ink-strong">{title}</div>
          {action}
        </div>
      )}
      <div className={padding ? 'p-5' : ''}>{children}</div>
    </div>
  );
}
