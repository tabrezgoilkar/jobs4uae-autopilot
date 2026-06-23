import { PageHeader, Card } from '../components/ui';

export default function AutoApplyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Auto-apply"
        subtitle="Assisted applications — the copilot prepares, you always click Submit."
      />
      <Card>
        <p className="text-sm leading-relaxed text-ink-secondary">
          Assisted Auto-Apply is on the way. You'll connect your job-board accounts once, then the app will open a
          job, fill the application, and stop at the Submit button for you to review and send.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs rounded-md px-3 py-2.5 text-ai-700 bg-ai-soft border border-ai-soft">
          It never applies on your behalf — you always click Submit. No passwords are stored.
        </div>
      </Card>
    </div>
  );
}
