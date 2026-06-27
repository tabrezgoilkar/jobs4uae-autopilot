import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { Profile } from '../../api';
import type { CvTemplateId } from './cvTypes';

function html(text: string) {
  return DOMPurify.sanitize(marked.parse((text || '').replace(/\s*[••‣◦⁃∙]\s+/g, '\n- '), { async: false }) as string);
}
const contactLine = (p: Profile) => [p.email, p.phone, p.location].filter((s) => s?.trim()).join('  ·  ');
const dates = (a?: string, b?: string) => [a, b].filter(Boolean).join(' – ');

// A4-ish page; black-on-white, print-friendly. Inline styles so it prints
// identically regardless of app CSS.
const page = { width: '100%', maxWidth: 794, margin: '0 auto', background: '#fff', color: '#1a1a1a', boxSizing: 'border-box' as const };

export function CvDocument({ profile, template }: { profile: Profile; template: CvTemplateId }) {
  if (template === 'modern') return <Modern p={profile} />;
  if (template === 'minimal') return <Minimal p={profile} />;
  return <Classic p={profile} />;
}

/* ---------------- Classic — traditional GCC/UAE ---------------- */
function Classic({ p }: { p: Profile }) {
  const H = { fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: '#1a1a1a', borderBottom: '1.5px solid #1a1a1a', paddingBottom: 4, margin: '18px 0 8px' };
  return (
    <div style={{ ...page, fontFamily: 'Georgia, "Times New Roman", serif', padding: '44px 48px', fontSize: 12.5, lineHeight: 1.5 }}>
      <div style={{ textAlign: 'center', borderBottom: '2px solid #1a1a1a', paddingBottom: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.02em' }}>{p.fullName || 'Your Name'}</div>
        {p.headline && <div style={{ fontSize: 13, color: '#444', marginTop: 3 }}>{p.headline}</div>}
        {contactLine(p) && <div style={{ fontSize: 11.5, color: '#555', marginTop: 6 }}>{contactLine(p)}</div>}
      </div>
      {p.summary?.trim() && (<><div style={H}>Profile</div><div dangerouslySetInnerHTML={{ __html: html(p.summary) }} /></>)}
      {p.skills.length > 0 && (<><div style={H}>Core Skills</div><div>{p.skills.join('  ·  ')}</div></>)}
      {p.experience.length > 0 && (<><div style={H}>Experience</div>{p.experience.map((x, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}><b>{x.title}{x.company ? `, ${x.company}` : ''}</b><span style={{ color: '#555', whiteSpace: 'nowrap' }}>{dates(x.startDate, x.endDate)}</span></div>
          {x.description?.trim() && <div style={{ marginTop: 3 }} dangerouslySetInnerHTML={{ __html: html(x.description) }} />}
        </div>
      ))}</>)}
      {p.education.length > 0 && (<><div style={H}>Education</div>{p.education.map((x, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}><span><b>{[x.degree, x.field].filter(Boolean).join(', ')}</b>{x.institution ? ` — ${x.institution}` : ''}</span><span style={{ color: '#555' }}>{x.year}</span></div>
      ))}</>)}
      {p.certifications.length > 0 && (<><div style={H}>Certifications</div>{p.certifications.map((x, i) => <div key={i}>{x.name}{[x.issuer, x.year].filter(Boolean).length ? ` — ${[x.issuer, x.year].filter(Boolean).join(', ')}` : ''}</div>)}</>)}
      {p.languages.length > 0 && (<><div style={H}>Languages</div><div>{p.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ''}`).join('  ·  ')}</div></>)}
    </div>
  );
}

/* ---------------- Modern — accent header + two columns ---------------- */
function Modern({ p }: { p: Profile }) {
  const accent = '#2D5BD6';
  const H = { fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' as const, color: accent, margin: '0 0 7px' };
  const sideH = { ...H, color: '#fff', opacity: 0.9 };
  return (
    <div style={{ ...page, fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 12, lineHeight: 1.5 }}>
      <div style={{ background: accent, color: '#fff', padding: '28px 36px' }}>
        <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.01em' }}>{p.fullName || 'Your Name'}</div>
        {p.headline && <div style={{ fontSize: 13.5, marginTop: 4, opacity: 0.95 }}>{p.headline}</div>}
      </div>
      <div style={{ display: 'flex', minHeight: 600 }}>
        <div style={{ width: 232, flex: 'none', background: '#0f2a66', color: '#fff', padding: '24px 22px' }}>
          {contactLine(p) && (<><div style={sideH}>Contact</div><div style={{ fontSize: 11.5, lineHeight: 1.8, marginBottom: 18 }}>{[p.email, p.phone, p.location].filter(Boolean).map((c, i) => <div key={i}>{c}</div>)}</div></>)}
          {p.skills.length > 0 && (<><div style={sideH}>Skills</div><div style={{ marginBottom: 18 }}>{p.skills.map((s, i) => <div key={i} style={{ fontSize: 11.5, padding: '2px 0' }}>{s}</div>)}</div></>)}
          {p.languages.length > 0 && (<><div style={sideH}>Languages</div><div>{p.languages.map((l, i) => <div key={i} style={{ fontSize: 11.5, padding: '2px 0' }}>{l.name}{l.level ? ` — ${l.level}` : ''}</div>)}</div></>)}
        </div>
        <div style={{ flex: 1, padding: '24px 30px' }}>
          {p.summary?.trim() && (<div style={{ marginBottom: 16 }}><div style={H}>Profile</div><div dangerouslySetInnerHTML={{ __html: html(p.summary) }} /></div>)}
          {p.experience.length > 0 && (<div style={{ marginBottom: 16 }}><div style={H}>Experience</div>{p.experience.map((x, i) => (
            <div key={i} style={{ marginBottom: 11 }}>
              <div style={{ fontWeight: 700 }}>{x.title}</div>
              <div style={{ color: accent, fontSize: 11.5 }}>{[x.company, dates(x.startDate, x.endDate)].filter(Boolean).join(' · ')}</div>
              {x.description?.trim() && <div style={{ marginTop: 3 }} dangerouslySetInnerHTML={{ __html: html(x.description) }} />}
            </div>
          ))}</div>)}
          {p.education.length > 0 && (<div style={{ marginBottom: 16 }}><div style={H}>Education</div>{p.education.map((x, i) => (
            <div key={i} style={{ marginBottom: 5 }}><b>{[x.degree, x.field].filter(Boolean).join(', ')}</b><div style={{ color: '#555', fontSize: 11.5 }}>{[x.institution, x.year].filter(Boolean).join(' · ')}</div></div>
          ))}</div>)}
          {p.certifications.length > 0 && (<div><div style={H}>Certifications</div>{p.certifications.map((x, i) => <div key={i} style={{ fontSize: 11.5 }}>{x.name}{x.issuer ? ` — ${x.issuer}` : ''}</div>)}</div>)}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Minimal — clean ATS single column ---------------- */
function Minimal({ p }: { p: Profile }) {
  const H = { fontSize: 11.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#888', margin: '20px 0 8px' };
  return (
    <div style={{ ...page, fontFamily: '"Helvetica Neue", Arial, sans-serif', padding: '52px 56px', fontSize: 12.5, lineHeight: 1.6 }}>
      <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: '0.01em' }}>{p.fullName || 'Your Name'}</div>
      {p.headline && <div style={{ fontSize: 13.5, color: '#333', marginTop: 2 }}>{p.headline}</div>}
      {contactLine(p) && <div style={{ fontSize: 11.5, color: '#777', marginTop: 8 }}>{contactLine(p)}</div>}
      {p.summary?.trim() && (<><div style={H}>Summary</div><div dangerouslySetInnerHTML={{ __html: html(p.summary) }} /></>)}
      {p.experience.length > 0 && (<><div style={H}>Experience</div>{p.experience.map((x, i) => (
        <div key={i} style={{ marginBottom: 12 }}>
          <div style={{ fontWeight: 600 }}>{x.title}{x.company ? ` · ${x.company}` : ''}</div>
          {dates(x.startDate, x.endDate) && <div style={{ color: '#999', fontSize: 11.5 }}>{dates(x.startDate, x.endDate)}</div>}
          {x.description?.trim() && <div style={{ marginTop: 4 }} dangerouslySetInnerHTML={{ __html: html(x.description) }} />}
        </div>
      ))}</>)}
      {p.education.length > 0 && (<><div style={H}>Education</div>{p.education.map((x, i) => <div key={i} style={{ marginBottom: 4 }}>{[x.degree, x.field].filter(Boolean).join(', ')}{x.institution ? ` · ${x.institution}` : ''}{x.year ? ` · ${x.year}` : ''}</div>)}</>)}
      {p.skills.length > 0 && (<><div style={H}>Skills</div><div>{p.skills.join(' · ')}</div></>)}
      {p.certifications.length > 0 && (<><div style={H}>Certifications</div>{p.certifications.map((x, i) => <div key={i}>{x.name}{[x.issuer, x.year].filter(Boolean).length ? ` — ${[x.issuer, x.year].filter(Boolean).join(', ')}` : ''}</div>)}</>)}
      {p.languages.length > 0 && (<><div style={H}>Languages</div><div>{p.languages.map((l) => `${l.name}${l.level ? ` (${l.level})` : ''}`).join(' · ')}</div></>)}
    </div>
  );
}
