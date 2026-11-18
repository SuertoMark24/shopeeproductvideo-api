import { isSync, isViewer, body } from '../lib/auth.js';
import { readItems, writeItem, deleteUrls, orphanVideos, publicItem, validId, MAX_ITEMS } from '../lib/store.js';

// GET  /api/items   (x-passphrase or x-sync-token) -> { items: [...], max }
// POST /api/items   (x-sync-token; "delete" also accepts x-passphrase)
//   { action: "add",    id, title, caption, shopeeUrl, videoUrl, downloadUrl, sizeBytes }
//   { action: "update", id, title?, caption?, shopeeUrl? }
//   { action: "done",   id, done: true|false }   (also x-passphrase)
//   { action: "delete", id }                     (also x-passphrase)
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (!isViewer(req)) return res.status(401).json({ error: 'bad_passphrase' });
    const items = await readItems();
    return res.status(200).json({ ok: true, max: MAX_ITEMS, items: items.map(publicItem) });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const b = body(req);
  // The phone (passphrase) may mark a video done or delete it; add/update stay Stitchify-only.
  const allowed = b.action === 'delete' || b.action === 'done' ? isViewer(req) : isSync(req);
  if (!allowed) return res.status(401).json({ error: 'bad_token' });

  if (!validId(b.id)) return res.status(400).json({ error: 'bad_id' });
  const items = await readItems();
  const existing = items.find((i) => i.id === b.id);

  if (b.action === 'add') {
    if (existing) return res.status(409).json({ error: 'exists' });
    if (items.length >= MAX_ITEMS) {
      // The upload already happened — don't leave the video behind.
      await deleteUrls([b.videoUrl]);
      return res.status(409).json({ error: 'full', detail: `The site already holds ${MAX_ITEMS} videos.` });
    }
    if (!/^https:\/\/[^/]+\.blob\.vercel-storage\.com\//.test(String(b.videoUrl || ''))) {
      return res.status(400).json({ error: 'bad_video_url' });
    }
    const item = await writeItem({ ...b, createdAt: new Date().toISOString() });
    // Housekeeping: drop videos from uploads that never finished (older than an hour).
    try { await deleteUrls(await orphanVideos([...items, item])); } catch { /* best effort */ }
    return res.status(200).json({ ok: true, item });
  }

  if (!existing) return res.status(404).json({ error: 'not_found' });

  if (b.action === 'update') {
    const item = await writeItem({
      ...existing,
      title: b.title ?? existing.title,
      caption: b.caption ?? existing.caption,
      shopeeUrl: b.shopeeUrl ?? existing.shopeeUrl,
    });
    await deleteUrls([existing._url]);
    return res.status(200).json({ ok: true, item });
  }

  if (b.action === 'done') {
    const item = await writeItem({ ...existing, done: Boolean(b.done) });
    await deleteUrls([existing._url]);
    return res.status(200).json({ ok: true, item });
  }

  if (b.action === 'delete') {
    await deleteUrls([existing._url, existing.videoUrl]);
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'bad_action' });
}
