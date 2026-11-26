import { randomBytes } from 'node:crypto';
import { generateClientTokenFromReadWriteToken } from '@vercel/blob/client';
import { isSync } from '../lib/auth.js';
import { readItems, activeCount, MAX_ITEMS } from '../lib/store.js';

// POST /api/upload-token   (header x-sync-token)
// -> { id, pathname, clientToken }
// Stitchify then PUTs the video straight to Vercel Blob with clientToken (bypassing Vercel's 4.5 MB
// function body limit), and finally POSTs { action: "add" } to /api/items.
const MAX_BYTES = 200 * 1024 * 1024;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!isSync(req)) return res.status(401).json({ error: 'bad_token' });

  const items = await readItems();
  if (activeCount(items) >= MAX_ITEMS) {
    return res.status(409).json({ error: 'full', detail: `The phone already has ${MAX_ITEMS} videos waiting. Mark some Done first.` });
  }

  const id = randomBytes(8).toString('hex');
  const pathname = `videos/${id}.mp4`;
  const clientToken = await generateClientTokenFromReadWriteToken({
    pathname,
    addRandomSuffix: true,
    allowedContentTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
    maximumSizeInBytes: MAX_BYTES,
    validUntil: Date.now() + 10 * 60 * 1000,
  });

  return res.status(200).json({ ok: true, id, pathname, clientToken });
}
