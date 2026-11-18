import { timingSafeEqual } from 'node:crypto';

// Two separate secrets (Vercel env vars):
//   SYNC_TOKEN       — Stitchify's write key (add / update / delete / upload token). Header: x-sync-token
//   VIEW_PASSPHRASE  — what the owner types on the phone (read-only list). Header: x-passphrase
// The sync token can also read, so the app can list what's on the site.

function same(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

export function isSync(req) {
  const expected = process.env.SYNC_TOKEN || '';
  return expected.length >= 16 && same(req.headers['x-sync-token'], expected);
}

export function isViewer(req) {
  const expected = process.env.VIEW_PASSPHRASE || '';
  return isSync(req) || (expected.length > 0 && same(req.headers['x-passphrase'], expected));
}

// Small JSON body reader — Vercel parses JSON already, but be safe when it hands over a string.
export function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}
