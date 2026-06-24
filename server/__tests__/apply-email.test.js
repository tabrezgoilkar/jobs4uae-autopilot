import { describe, it, expect } from 'vitest';
import { extractEmails, mailtoLink, gmailComposeLink, composeApplicationEmail } from '../apply/email/compose.js';

describe('extractEmails', () => {
  it('pulls recruiter emails from a pasted post (deduped, lowercased)', () => {
    const post = 'We are hiring an Accountant! Send your CV to HR@acme.com or careers@acme.com. Thanks, HR@acme.com';
    expect(extractEmails(post)).toEqual(['hr@acme.com', 'careers@acme.com']);
  });
  it('returns [] when there is no email', () => {
    expect(extractEmails('DM me on LinkedIn')).toEqual([]);
    expect(extractEmails('')).toEqual([]);
  });
  it('ignores obvious non-addresses', () => {
    expect(extractEmails('salary 10k @ month, contact me')).toEqual([]);
  });
});

describe('mailtoLink / gmailComposeLink', () => {
  const args = { to: 'hr@acme.com', subject: 'Application: Accountant', body: 'Dear Hiring Manager,\nPlease find…' };
  it('builds a mailto: link with encoded subject and body', () => {
    const link = mailtoLink(args);
    expect(link.startsWith('mailto:hr@acme.com?')).toBe(true);
    expect(link).toContain('subject=Application%3A%20Accountant');
    expect(link).toContain('body=');
    expect(link).not.toContain('\n'); // newlines encoded
  });
  it('builds a Gmail compose deep link', () => {
    const link = gmailComposeLink(args);
    expect(link).toContain('mail.google.com/mail/?view=cm&fs=1');
    expect(link).toContain('to=hr%40acme.com');
    expect(link).toContain('su=Application%3A%20Accountant');
  });
});

describe('composeApplicationEmail', () => {
  const profile = { fullName: 'Jane Doe', headline: 'Senior Accountant', summary: '8 years in GCC finance.', skills: ['IFRS', 'SAP'] };
  const engine = (text) => ({ generate: async () => text });

  it('returns a structured subject + body from the engine', async () => {
    const out = await composeApplicationEmail(
      profile,
      'Accountant role at Acme, Dubai',
      { email: 'hr@acme.com', company: 'Acme' },
      engine('{"subject":"Application: Senior Accountant — Jane Doe","body":"Dear Hiring Manager,\\nI am writing to apply…"}'),
    );
    expect(out.subject).toContain('Senior Accountant');
    expect(out.body).toContain('Dear Hiring Manager');
  });

  it('falls back to a sensible subject when the AI omits one', async () => {
    const out = await composeApplicationEmail(profile, 'Accountant role', { email: 'hr@acme.com' }, engine('{"body":"Hello, please consider my application."}'));
    expect(out.subject).toBeTruthy();
    expect(out.body).toContain('please consider');
  });

  it('throws a friendly error when the engine returns junk', async () => {
    await expect(
      composeApplicationEmail(profile, 'role', { email: 'x@y.com' }, engine('sorry cannot help')),
    ).rejects.toThrow(/could not/i);
  });
});
