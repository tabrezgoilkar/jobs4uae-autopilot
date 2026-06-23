import dns from 'node:dns/promises';
import net from 'node:net';

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

// Extract the embedded IPv4 from a v4-mapped IPv6, in dotted (::ffff:1.2.3.4)
// or hex (::ffff:7f00:1) form. Returns dotted-quad string or null.
function mappedV4(addr) {
  const m = addr.match(/^::ffff:(.+)$/i);
  if (!m) return null;
  const rest = m[1];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(rest)) return rest;
  const g = rest.split(':');
  if (g.length === 2 && g.every((x) => /^[0-9a-f]{1,4}$/i.test(x))) {
    const hi = parseInt(g[0], 16);
    const lo = parseInt(g[1], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

/** True if an IP literal is loopback / private / link-local / reserved. */
export function isBlockedAddress(ip) {
  if (typeof ip !== 'string' || !ip) return true;
  const addr = ip.toLowerCase().trim().replace(/^\[|\]$/g, ''); // tolerate brackets
  if (net.isIPv4(addr)) return ipv4Blocked(addr);
  if (net.isIPv6(addr)) {
    const mv4 = mappedV4(addr); // IPv4-mapped → judge by the embedded v4
    if (mv4) return ipv4Blocked(mv4);
    if (addr === '::1' || addr === '::') return true;  // loopback / unspecified
    if (/^fe[89ab]/.test(addr)) return true;           // fe80::/10 link-local
    if (/^f[cd]/.test(addr)) return true;              // fc00::/7 unique-local
    return false;
  }
  return true; // not a recognizable IP → treat as blocked
}

/**
 * Validate a user-supplied URL is safe to fetch server-side.
 * Throws Error('SSRF_BLOCKED') for non-http(s), internal hostnames, or hosts
 * that resolve to a blocked address. Allows any public http(s) URL.
 * @returns {Promise<{host: string, ip: string}>} the validated host + a public IP it resolved to (for DNS pinning).
 */
export async function assertFetchableUrl(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('SSRF_BLOCKED'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('SSRF_BLOCKED');

  // new URL() keeps IPv6 hostnames bracketed (e.g. "[::1]") — strip before classifying.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('SSRF_BLOCKED');
  }
  // Host is already an IP literal — classify directly, no DNS.
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new Error('SSRF_BLOCKED');
    return { host, ip: host };
  }
  // Otherwise resolve and reject if ANY address is internal (defeats split-result tricks).
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('SSRF_BLOCKED');
  }
  if (!addrs.length || addrs.some((a) => isBlockedAddress(a.address))) {
    throw new Error('SSRF_BLOCKED');
  }
  return { host, ip: addrs[0].address };
}
