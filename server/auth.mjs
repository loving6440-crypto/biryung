import { randomBytes, scrypt as scryptCallback, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const COOKIE_NAME = 'biryeong_sid';
export const SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;
export const COLORS = ['#d4b078','#68a9b9','#d56b69','#8fa997','#b1a1cc','#d7b389'];
export function validateUsername(value) { return typeof value === 'string' && USERNAME_RE.test(value); }
export function normalizeUsername(value) { return String(value || '').trim().toLowerCase(); }
export function validatePassword(value) { return typeof value === 'string' && value.length >= 8 && value.length <= 128; }
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${derived.toString('hex')}`;
}
export async function verifyPassword(password, saved) {
  const parts = String(saved || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false;
  const derived = await scrypt(password, parts[1], 64);
  return timingSafeEqual(derived, Buffer.from(parts[2], 'hex'));
}
export function newSessionToken() { return randomBytes(32).toString('base64url'); }
export function tokenHash(token) { return createHash('sha256').update(token).digest('hex'); }
export function parseCookie(header) {
  const part = String(header || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(`${COOKIE_NAME}=`));
  const value = part?.slice(COOKIE_NAME.length + 1) || '';
  return /^[A-Za-z0-9_-]{40,100}$/.test(value) ? value : null;
}
export function cookieHeader(token, secure, clear = false) {
  return `${COOKIE_NAME}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${clear ? 0 : SESSION_AGE_MS / 1000}${secure ? '; Secure' : ''}`;
}
export function memberCanRead(thread, user) {
  return Boolean(thread && user && (Number(thread.user_low_id) === Number(user.id) || Number(thread.user_high_id) === Number(user.id)));
}
export function adminCanAudit(user) { return user?.role === 'admin'; }
