import { Component, type ReactNode } from 'react';

interface State { error: Error | null; }

// Global error boundary. Without this, any render-time throw unmounts the whole
// React tree and the user sees a blank page (the "glimpse then disappear" bug).
// With it, we show the error text so the real cause is visible instead of blank.
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // Surfaced to the console for debugging; intentionally not sent anywhere.
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      const stack = (e as any)?.stack ? String((e as any).stack) : String(e);
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-2xl w-full rounded-md border border-danger-soft bg-surface p-5 shadow-sm space-y-3">
            <div className="text-[14px] font-bold text-danger-text">Something broke on this page</div>
            <p className="text-[12.5px] text-ink-secondary leading-relaxed">
              The page hit an unexpected error and stopped rendering. Try reloading. If it keeps happening,
              your saved profile may contain data the page can’t display — re-open My profile and check the resume/CV section.
            </p>
            <pre className="text-[11.5px] text-ink-muted whitespace-pre-wrap break-words rounded bg-surface-sunken p-2 max-h-60 overflow-auto">{stack}</pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center h-9 px-4 rounded-md bg-primary-600 text-white text-[12.5px] font-semibold"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
