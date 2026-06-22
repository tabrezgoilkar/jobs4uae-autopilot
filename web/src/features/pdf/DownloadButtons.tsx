import { useState } from 'react';
import { downloadPdf } from './pdfApi';
import { Button } from '../../components/ui';

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
      <Button variant="secondary" onClick={() => handleDownload('resume')} disabled={!docId || busyResume} aria-label="Download resume as PDF">
        {busyResume ? 'Generating…' : 'Resume PDF'}
      </Button>
      <Button variant="secondary" onClick={() => handleDownload('cover')} disabled={!docId || busyCover} aria-label="Download cover letter as PDF">
        {busyCover ? 'Generating…' : 'Cover Letter PDF'}
      </Button>
      {error && (
        <span className="text-sm text-danger-text" role="alert">{error}</span>
      )}
    </span>
  );
}
