# Cloudflare Worker – HLS + image + subtitle proxy

Moves **video and manga image egress** off Vercel and Railway. Keep Railway for search / episodes / sources only.

```
Browser  →  CF Worker /proxy  →  CDN (m3u8 + .ts)
Browser  →  CF Worker /image  →  CDN (manga pages, locked posters)
Browser  →  CF Worker /subtitles  →  VTT (ASS/SRT converted)
Browser  →  Vercel /api/*  →  Railway streaming-api (catalog JSON only; URL not public)
Browser  →  Vercel  →  website HTML/JS only
```

**Preferred production env:**

```env
HIANIME_API_URL=https://streaming-api-july-production.up.railway.app
NEXT_PUBLIC_PROXY_URL=https://anime-world-proxy.animevillage-proxy.workers.dev/proxy
NEXT_PUBLIC_USE_PROXY=true
```

Do **not** set `NEXT_PUBLIC_HIANIME_API_URL` in production (leaks Railway to browsers).
Do **not** set `NEXT_PUBLIC_PROXY_URL` to `animevillage.org/api/proxy` or Railway `/api/v2/proxy`.

## 1. Deploy the Worker

```bash
cd anime-world/cf-worker
npm install
npx wrangler login
npx wrangler deploy
```

Smoke test:

- `https://…workers.dev/` → `{ ok: true }`
- `https://…workers.dev/proxy?url=` → HLS proxy
- `https://…workers.dev/image?url=` → image proxy
- `https://…workers.dev/subtitles?url=` → VTT subtitle proxy

## 2. Vercel env + redeploy

| Name | Value |
|------|--------|
| `HIANIME_API_URL` | Railway catalog API (**server-only**, not `NEXT_PUBLIC_`) |
| `NEXT_PUBLIC_PROXY_URL` | `https://anime-world-proxy.<subdomain>.workers.dev/proxy` |
| `NEXT_PUBLIC_USE_PROXY` | `true` |

Remove `NEXT_PUBLIC_HIANIME_API_URL` if present. `NEXT_PUBLIC_*` changes need a **redeploy**.

### Local

```env
HIANIME_API_URL=http://localhost:4000
NEXT_PUBLIC_PROXY_URL=http://localhost:4000/api/v2/proxy
NEXT_PUBLIC_USE_PROXY=true
```

Local images still use Next `/api/image`.

## 3. Verify

1. Play an episode: `.m3u8` / `.ts` → **`*.workers.dev/proxy`**, subtitles → **`*.workers.dev/subtitles`**, not Vercel.
2. Read a manga chapter: images → **`*.workers.dev/image`**, not `/api/image`.
3. Vercel Fast Data Transfer should drop. Cloudflare Worker bandwidth is the stream cost.
