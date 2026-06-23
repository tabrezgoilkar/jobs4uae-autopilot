import dns from 'node:dns/promises';

// SSRF guard for the "paste a job link" fetch: allow arbitrary PUBLIC URLs,
// but block requests that resolve to internal / loopback / metadata addresses.

function ipv4Blocked(ip) {
  const m = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 0) return true;                       // 0.0.0.0/8
  if (a === 10) return true;                      // 10/8 private
  if (a === 127) return true;                     // loopback
  if (a === 169 && b === 254) return true;        // 169.254/16 link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12 private
  if (a === 192 && b === 168) return true;        // 192.168/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64/10 CGNAT
  if (a >= 224) return true;                      // multicast / reserved
  return false;
}

/** True if an IP literal is loopback / private / link-local / reserved. */
export function isBlockedAddress(ip) {
  if (typeof ip !== 'string' || !ip) return true;
  const addr = ip.toLowerCase().trim();
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) → judge by the embedded v4.
  const mapped = addr.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mapped) return ipv4Blocked(mapped[1]);
  if (addr.includes(':')) {
    if (addr === '::1' || addr === '::') return true;      // loopback / unspecified
    if (/^fe[89ab]/.test(addr)) return true;               // fe80::/10 link-local
    if (/^f[cd]/.test(addr)) return true;                  // fc00::/7 unique-local
    return false;
  }
  return ipv4Blocked(addr);
}

/**
 * Validate a user-supplied URL is safe to fetch server-side.
 * Throws Error('SSRF_BLOCKED') for non-http(s), internal hostnames, or hosts
 * that resolve to a blocked address. Allows any public http(s) URL.
 */
export async function assertFetchableUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('SSRF_BLOCKED'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('SSRF_BLOCKED');

  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('SSRF_BLOCKED');
  }
  // If the host is already an IP literal, classify it directly.
  if (/^[\d.]+$/.test(host) || host.includes(':')) {
    if (isBlockedAddress(host)) throw new Error('SSRF_BLOCKED');
    return;
  }
  // Otherwise resolve and reject if ANY address is internal.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('SSRF_BLOCKED');
  }
  if (!addrs.length || addrs.some((a) => isBlockedAddress(a.address))) {
    throw new Error('SSRF_BLOCKED');
  }
}
