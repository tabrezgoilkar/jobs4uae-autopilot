import type { AppConfig } from '../api';

export default function Home({ config }: { config: AppConfig }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow p-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">You're all set! 🎉</h1>
        <p className="mt-3 text-slate-600">
          Jobs4UAE Autopilot is connected using{' '}
          <span className="font-semibold">{config.engine ?? 'unknown'}</span>.
        </p>
        <p className="mt-2 text-sm text-slate-400">
          More features arrive in the next phases (import CV, evaluate jobs, scan GCC boards).
        </p>
      </div>
    </div>
  );
}
