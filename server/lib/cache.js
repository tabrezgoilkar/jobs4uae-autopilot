// Tiny in-process cache + per-IP rate limiter for cloud (Vercel serverless).
//
// Why: the LinkedIn jobs-guest and FreeHire endpoints are public but
// rate-limited / ToS-sensitive. A community deployment shares Vercel's egress
// IP pool, so without caching every user hit goes straight to the upstream and
// one surge can get the whole pool throttled. A short-TTL cache + a per-IP
// limiter keeps volume down and gives graceful degradation.
//
// Note: serverless functions are ephemeral, so this cache is per-instance and
// short-lived — it is a throttle, NOT a durable store. That's fine: even a
// 60s TTL collapses repeat searches and the limiter caps abuse per IP.

const cache = new Map(); // key -> { expires, value }

/**
 * Get a cached value or compute + store it.
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} producer
 */
export async function cached(key, ttlMs, producer) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) return hit.value;
  const value = await producer();
  cache.set(key, { expires: now + ttlMs, value });
  // Best-effort eviction so the map can't grow unbounded in a warm instance.
  if (cache.size > 200) {
    for (const [k, v] of cache) {
      if (v.expires <= now) cache.delete(k);
    }
  }
  return value;
}

// Per-IP counters: ip -> { windowStart, count }
const hits = new Map();

/**
 * Returns true if the IP is under its limit for this window.
 * @param {string} ip
 * @param {number} max  max requests per window
 * @param {number} windowMs
 */
export function rateLimit(ip, max = 20, windowMs = 60_000) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.windowStart > windowMs) {
    hits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  rec.count += 1;
  return rec.count <= max;
}

export function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  if (Array.isArray(xff) && xff.length) return String(xff[0]).trim();
  return req.socket?.remoteAddress || 'unknown';
}
