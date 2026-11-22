/** Request protections shared by the standalone Node HTTP server. */
import { isIP } from 'node:net';

// Proxy forwarding headers are trusted only when explicitly enabled (Render's proxy).
export function clientIp(req) {
  const socketIp = String(req.socket?.remoteAddress || 'unknown');
  if (process.env.TRUST_PROXY !== '1') return socketIp;
  const chain = String(req.headers['x-forwarded-for'] || '').split(',').map(x => x.trim());
  const last = chain.at(-1);
  return last && isIP(last) ? last : socketIp;
}
export function isHttps(req) {
  return Boolean(req.socket?.encrypted || (process.env.TRUST_PROXY === '1' && String(req.headers['x-forwarded-proto'] || '').split(',').at(-1)?.trim() === 'https'));
}
export function permittedOrigin(req, { crossOrigin = '' } = {}) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const remote = new URL(origin).origin;
    const scheme = isHttps(req) ? 'https' : 'http';
    const host = String(req.headers.host || '');
    if (!host || /[,\s/@\\]/.test(host)) return false;
    return remote === new URL(`${scheme}://${host}`).origin || Boolean(crossOrigin && remote === new URL(crossOrigin).origin);
  } catch { return false; }
}

const buckets = new Map();
let checks = 0;
export function limit(key, maximum, windowMs) {
  const now = Date.now();
  if (++checks % 128 === 0 || buckets.size > 8000) {
    for (const [k,v] of buckets) if (v.until <= now) buckets.delete(k);
    while (buckets.size > 8000) buckets.delete(buckets.keys().next().value);
  }
  const item = buckets.get(key);
  const slot = item && item.until > now ? item : { until: now + windowMs, count: 0 };
  slot.count++;
  buckets.set(key, slot);
  return slot.count <= maximum;
}

const pending = new Map();
export function enter(ip, maximum = 12) {
  const count = pending.get(ip) || 0;
  if (count >= maximum) return null;
  pending.set(ip,count+1);
  let done = false;
  return () => {
    if (done) return;
    done = true;
    const cur = pending.get(ip) || 1;
    if (cur <= 1) pending.delete(ip); else pending.set(ip,cur-1);
  };
}
