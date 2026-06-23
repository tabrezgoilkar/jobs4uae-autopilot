/**
 * A–F grade chip with the design's grade tints.
 * Tokens used where they exist; C/D use literal amber/orange with dark fallbacks.
 */
const GRADE: Record<string, string> = {
  A: 'bg-success-soft text-success-text border border-success-soft',
  B: 'bg-primary-50 text-primary-700 border border-primary-100',
  C: 'bg-warning-soft text-warning-text border border-warning-soft',
  D: 'bg-[#FBE3CE] text-[#9A3412] border border-[#F3D9A8] dark:bg-[#3A2410] dark:text-[#F4B473] dark:border-[#5A3A18]',
  E: 'bg-[#FBE3CE] text-[#9A3412] border border-[#F3D9A8] dark:bg-[#3A2410] dark:text-[#F4B473] dark:border-[#5A3A18]',
  F: 'bg-danger-soft text-danger-text border border-danger-soft',
};

export default function GradeBadge({ grade, size = 'md' }: { grade: string; size?: 'sm' | 'md' }) {
  const g = (grade || '?').toUpperCase().slice(0, 1);
  const tint = GRADE[g] ?? 'bg-surface-sunken text-ink-secondary border border-hair';
  if (size === 'sm') {
    return (
      <span className={`inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold ${tint}`}>
        {g}
      </span>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center rounded-md font-bold ${tint}`} style={{ width: 46, height: 46 }}>
      <span className="text-lg leading-none">{g}</span>
    </div>
  );
}
