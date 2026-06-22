import type { AppConfig } from '../api';
import { Card, PageHeader, ButtonLink } from '../components/ui';

const STEPS = [
  {
    n: 1,
    title: 'Set up your profile',
    body: "Upload your CV and we'll turn it into a profile we can use to score jobs and tailor resumes.",
    to: '/profile',
    cta: 'Go to My profile →',
  },
  {
    n: 2,
    title: 'Find & evaluate jobs',
    body: 'Scan GCC boards for roles, or paste any job description to get an honest A–F fit score.',
    to: '/scan',
    cta: 'Scan GCC boards →',
  },
  {
    n: 3,
    title: 'Tailor your documents',
    body: 'Generate a tailored resume and cover letter for any job, then download them as PDFs.',
    to: '/documents',
    cta: 'Resume & cover letter →',
  },
];

export default function Dashboard({ config }: { config: AppConfig }) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="You're all set 🎉"
        subtitle={<>AI is connected using <span className="font-semibold text-ink">{config.engine ?? 'unknown'}</span>. Here's how to get started.</>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n}>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-md bg-primary-50 text-primary-700 text-xs font-bold tabular-nums">{s.n}</span>
              <h2 className="font-semibold text-ink-strong text-sm">{s.title}</h2>
            </div>
            <p className="mt-2 text-sm text-ink-secondary leading-relaxed">{s.body}</p>
            <ButtonLink to={s.to} size="sm" className="mt-4">{s.cta}</ButtonLink>
          </Card>
        ))}
      </div>

      <Card>
        <div className="flex items-start gap-3">
          <span className="text-base">✨</span>
          <p className="text-sm text-ink-secondary leading-relaxed">
            A richer Home dashboard — live pipeline stats, a daily briefing and an AI career copilot — is on the way.
            For now, jump in from the steps above or the sidebar.
          </p>
        </div>
      </Card>
    </div>
  );
}
