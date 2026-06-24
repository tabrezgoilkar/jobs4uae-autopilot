import { Link } from 'react-router-dom';
import { Card, PageHeader } from '../components/ui';
import { IconSparkle } from '../components/icons';

// Shown in the cloud build for features that aren't online yet, so users never
// land on a non-functional page. Scan + Auto-apply need a real browser (the
// Phase B desktop companion); Evaluate + Tracker come online once their data is
// per-user.
export default function ComingSoon({ title, kind }: { title: string; kind: 'companion' | 'soon' }) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle="Not available in the web app yet" />
      <Card>
        <div className="text-center py-10 px-4">
          <span className="inline-grid place-items-center w-12 h-12 rounded-md j4u-grad-ai mb-4"><IconSparkle size={22} color="var(--ai-600)" /></span>
          <div className="text-[16px] font-bold text-ink-strong">{title} is coming soon</div>
          <p className="mt-2 text-sm text-ink-secondary max-w-md mx-auto leading-relaxed">
            {kind === 'companion'
              ? `${title} drives a real browser you log into and watch, so it can't run on the web server. It'll arrive as a lightweight desktop companion that pairs with your account.`
              : `${title} is being brought online next. For now, use it in the desktop app — it'll appear here shortly.`}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Link to="/profile" className="inline-flex items-center h-9 px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold j4u-press">Go to My Profile</Link>
            <Link to="/documents" className="j4u-chip inline-flex items-center h-9 px-4 rounded-md border border-hair text-ink-secondary text-[12.5px] font-semibold">Documents</Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
