import { list, put, del } from '@vercel/blob';

// Everything lives in Vercel Blob — no database.
//   videos/{id}-<random>.mp4   the video (uploaded straight from Stitchify with a client token)
//   items/{id}-<random>.json   one small, immutable record per video
// Records are never overwritten: an edit writes a new record and deletes the old one. Overwriting a
// single items.json would risk the Blob CDN serving a stale copy for up to a minute, and a second
// add in that window would silently drop the first. list() itself is not cached.

export const MAX_ITEMS = 10;

const ID_RE = /^[a-z0-9]{8,40}$/;
export const validId = (id) => ID_RE.test(String(id || ''));

const recordId = (pathname) => pathname.slice('items/'.length).split('-')[0];

/** All records, newest first. Each carries `_url` (its own blob) for delete/replace. */
export async function readItems() {
  const { blobs } = await list({ prefix: 'items/', limit: 100 });
  const rows = await Promise.all(blobs.map(async (b) => {
    try {
      const r = await fetch(b.url, { cache: 'no-store' });
      if (!r.ok) return null;
      const item = await r.json();
      return { ...item, id: recordId(b.pathname), _url: b.url };
    } catch { return null; }
  }));
  return rows.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export async function writeItem(item) {
  const clean = {
    title: String(item.title || '').slice(0, 300),
    caption: String(item.caption || '').slice(0, 2200),
    shopeeUrl: String(item.shopeeUrl || '').slice(0, 1000),
    videoUrl: String(item.videoUrl || ''),
    downloadUrl: String(item.downloadUrl || ''),
    sizeBytes: Number(item.sizeBytes) || 0,
    createdAt: item.createdAt || new Date().toISOString(),
    // Marked on the phone after posting it on Shopee (kept until the video is deleted).
    done: Boolean(item.done),
  };
  await put(`items/${item.id}.json`, JSON.stringify(clean), {
    access: 'public',
    addRandomSuffix: true,
    contentType: 'application/json',
  });
  return { ...clean, id: item.id };
}

export async function deleteUrls(urls) {
  const real = urls.filter(Boolean);
  if (real.length) await del(real);
}

/** Video blobs no record points at (an upload whose "add" never arrived). */
export async function orphanVideos(items) {
  const { blobs } = await list({ prefix: 'videos/', limit: 100 });
  const used = new Set(items.map((i) => i.videoUrl));
  const hourAgo = Date.now() - 60 * 60 * 1000;
  return blobs.filter((b) => !used.has(b.url) && new Date(b.uploadedAt).getTime() < hourAgo).map((b) => b.url);
}

export const publicItem = ({ _url, ...rest }) => rest;
