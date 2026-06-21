export default function AutoApplyPage() {
  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="t-h1">Auto-apply</h1>
      <p className="t-body" style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
        Assisted Auto-Apply is on the way. You'll connect your job-board accounts once, then the app will open a
        job, fill the application, and stop at the Submit button for you to review and send.
      </p>
      <div
        style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5,
          color: 'var(--ai-700)', background: 'var(--ai-soft)', border: '1px solid var(--ai-50)',
          borderRadius: 8, padding: '9px 13px',
        }}
      >
        It never applies on your behalf — you always click Submit. No passwords are stored.
      </div>
    </div>
  );
}
