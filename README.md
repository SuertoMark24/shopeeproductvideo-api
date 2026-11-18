# shopeeproductvideo-api

A private, phone-friendly page for posting on Shopee. Stitchify (admin only, **Shopee Videos** page) uploads each video together with its Shopee caption, hashtags and product link. On your phone you open this site and do three things:

- **Download** the video (or **Save / Share** it to Photos)
- **Copy caption**
- **Copy link**, or **Open in Shopee**

The site holds at most **10 videos**. Delete one in Stitchify to free a slot.

## One-time setup

1. Push this folder to a new GitHub repo, `shopeeproductvideo-api`, and import it in Vercel. No build settings are needed.
2. In Vercel, go to the project → **Storage** → **Create** → **Blob** (public access) → connect it to the project. This adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Go to the project → **Settings** → **Environment Variables** and add:
   - `SYNC_TOKEN`: press **Generate** on Stitchify's Shopee Videos page and paste the token here.
   - `VIEW_PASSPHRASE`: the passphrase you'll type on your phone.
4. **Redeploy** so the variables take effect.
5. In Stitchify → **Shopee Videos** → **Connection**, enter the Vercel URL and the same `SYNC_TOKEN`, then **Save & test**.
6. On your phone, open the Vercel URL, enter the passphrase once, and add the page to your Home Screen.

## API

All requests use JSON.

| Method | Path | Auth header | Purpose |
|---|---|---|---|
| GET | `/api/check` | `x-sync-token` or `x-passphrase` | Test credentials |
| GET | `/api/items` | `x-sync-token` or `x-passphrase` | List the videos, newest first |
| POST | `/api/upload-token` | `x-sync-token` | Get `{id, pathname, clientToken}` for a direct Blob upload. Refused when the site is full. |
| POST | `/api/items` | `x-sync-token` | `{action:"add"\|"update"\|"delete", id, ...}` |

Videos go straight from Stitchify to Vercel Blob (`PUT https://vercel.com/api/blob/?pathname=…` with the client token), so they aren't limited by Vercel's 4.5 MB request size.

## Storage

- Each record is its own small, never-overwritten blob (`items/{id}-*.json`). This avoids the Blob CDN serving a stale list.
- Videos are stored at `videos/{id}-*.mp4`.
- If an upload never finishes, its video is removed after an hour.
