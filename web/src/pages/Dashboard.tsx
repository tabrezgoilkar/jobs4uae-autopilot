import { Link } from 'react-router-dom';
import type { AppConfig } from '../api';

export default function Dashboard({ config }: { config: AppConfig }) {
  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800">You're all set! 🎉</h1>
      <p className="mt-2 text-slate-600">
        AI is connected using <span className="font-semibold">{config.engine ?? 'unknown'}</span>.
      </p>

      <div className="mt-6 bg-white rounded-2xl shadow p-6">
        <h2 className="font-semibold text-slate-800">Step 1: Set up your profile</h2>
        <p className="mt-1 text-sm text-slate-500">
          Upload your CV and we'll turn it into a profile we can use to score jobs and tailor resumes.
        </p>
        <Link
          to="/profile"
          className="inline-block mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
        >
          Go to My Profile →
        </Link>
      </div>

      <p className="mt-6 text-sm text-slate-400">
        Coming next: job evaluation, tailored resumes & cover letters, and GCC job scanning.
      </p>
    </div>
  );
}
