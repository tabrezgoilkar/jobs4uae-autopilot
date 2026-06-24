// Builds the self-contained "Send to Jobs4UAE" bookmarklet and its install page.
//
// Why self-contained: LinkedIn's CSP blocks injecting an external <script>, so all
// logic is inlined. The Voyager fetch is same-origin (CSP `connect-src 'self'` allows
// it). The POST to the local app may be CSP-blocked, so on any failure we fall back to
// a Blob file download (not a network request → not subject to CSP), which the user
// uploads in My Profile → Import from LinkedIn.

/** The bookmarklet body, before `javascript:` prefixing. `origin` = this server's origin. */
function source(origin) {
  // Kept compact and dependency-free; runs in the LinkedIn page context.
  return `(function(){try{
var m=location.pathname.match(/\\/in\\/([^/]+)/);
if(!m){alert('Open YOUR LinkedIn profile first (linkedin.com/in/your-name), then click this again.');return;}
var csrf=(document.cookie.match(/JSESSIONID="?([^";]+)"?/)||[])[1]||'';
fetch('/voyager/api/identity/profiles/'+m[1]+'/profileView',{headers:{'csrf-token':csrf,accept:'application/json'},credentials:'include'})
.then(function(r){if(!r.ok)throw new Error('LinkedIn said '+r.status+' (make sure you are logged in and on your own profile)');return r.json();})
.then(function(d){var j=JSON.stringify(d);
fetch('${origin}/api/profile/linkedin/import',{method:'POST',headers:{'Content-Type':'application/json'},body:j})
.then(function(res){if(!res.ok)throw 0;alert('\\u2705 Sent to Jobs4UAE! Open the app \\u2192 My Profile to review and save.');})
.catch(function(){var b=new Blob([j],{type:'application/json'});var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='linkedin-profile.json';document.body.appendChild(a);a.click();a.remove();alert('Saved linkedin-profile.json \\u2014 upload it in Jobs4UAE \\u2192 My Profile \\u2192 Import from LinkedIn.');});})
.catch(function(e){alert('Could not read your LinkedIn profile: '+e.message);});
}catch(e){alert('Bookmarklet error: '+e.message);}})();`;
}

/** Full `javascript:` bookmarklet string for `href` / drag-to-bookmarks-bar. */
export function bookmarkletCode(origin) {
  // Collapse to a single line and URI-encode so it survives as an href.
  const oneLine = source(origin).replace(/\n/g, '');
  return 'javascript:' + encodeURI(oneLine);
}

/** A standalone install page (served at /linkedin) with the draggable button. */
export function installPageHtml(origin) {
  const href = bookmarkletCode(origin).replace(/"/g, '&quot;');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Import your LinkedIn profile — Jobs4UAE</title>
<style>
  :root{color-scheme:light dark}
  body{font:15px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#1a1f2b}
  h1{font-size:22px;margin:0 0 4px} p{color:#3c4658}
  .btn{display:inline-block;padding:10px 16px;border:1px solid #c7d0e0;border-radius:6px;background:#0b5fff;color:#fff;text-decoration:none;font-weight:600;cursor:grab}
  ol{padding-left:18px} li{margin:8px 0}
  .note{font-size:13px;color:#6b7488;border-top:1px solid #e6eaf2;margin-top:28px;padding-top:14px}
  code{background:#eef1f7;padding:1px 5px;border-radius:4px}
</style></head><body>
<h1>Import your LinkedIn profile</h1>
<p>Runs entirely in your browser — your profile goes only to your local Jobs4UAE app, never to a cloud.</p>
<ol>
  <li>Drag this button to your bookmarks bar: &nbsp;<a class="btn" href="${href}">Send to Jobs4UAE</a></li>
  <li>Open <strong>your own</strong> LinkedIn profile (<code>linkedin.com/in/your-name</code>) while logged in.</li>
  <li>Click the <strong>Send to Jobs4UAE</strong> bookmark. It imports straight into the app, or saves a
      <code>linkedin-profile.json</code> file you upload in <strong>My Profile → Import from LinkedIn</strong>.</li>
</ol>
<p class="note">Uses LinkedIn's own data for your own profile. No automation or bulk scraping — just a one-tap export of your page.</p>
</body></html>`;
}
