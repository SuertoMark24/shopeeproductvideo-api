import { isSync, isViewer } from '../lib/auth.js';

// GET /api/check  -> { sync: bool, viewer: bool }   (401 when neither)
// Lets the phone test a passphrase and Stitchify test its sync token without touching data.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const sync = isSync(req);
  const viewer = isViewer(req);
  if (!sync && !viewer) return res.status(401).json({ error: 'unauthorized' });
  return res.status(200).json({ ok: true, sync, viewer, blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN) });
}
