import { useState } from 'react';
import { downloadPdf } from './pdfApi';

interface Props {
  docId: string | null;
}

export default function DownloadButtons({ docId }: Props) {
  const [busyResume, setBusyResume] = useState(false);
  const [busyCover, setBusyCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(kind: 'resume' | 'cover') {
    if (!docId) return;
    setError(null);
    if (kind === 'resume') setBusyResume(true);
    else setBusyCover(true);
    try {
      await downloadPdf(docId, kind);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed. Please try again.');
    } finally {
      if (kind === 'resume') setBusyResume(false);
      else setBusyCover(false);
    }
  }

  return (
    <span className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => handleDownload('resume')}
        disabled={!docId || busyResume}
        aria-label="Download resume as PDF"
        className="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium disabled:opacity-50"
      >
        {busyResume ? 'Generating…' : 'Resume PDF'}
      </button>
      <button
        onClick={() => handleDownload('cover')}
        disabled={!docId || busyCover}
        aria-label="Download cover letter as PDF"
        className="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium disabled:opacity-50"
      >
        {busyCover ? 'Generating…' : 'Cover Letter PDF'}
      </button>
      {error && (
        <span className="text-sm text-red-600" role="alert">{error}</span>
      )}
    </span>
  );
}
