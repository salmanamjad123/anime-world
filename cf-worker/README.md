# Cloudflare Worker – Video Proxy

Proxies HLS streams and subtitles so anime-world can play videos on Vercel without CDN/CORS blocks.

## Deploy

1. Install Wrangler (once): `npm install -g wrangler`
2. Log in: `wrangler login` (browser will open)
3. From this folder:
   ```bash
   cd cf-worker
   npx wrangler deploy
   ```
4. Copy the URL shown (e.g. `https://anime-world-proxy.anime-world-proxy.workers.dev`).

## Use with anime-world

- **Vercel:** Add env vars:
  - `NEXT_PUBLIC_USE_PROXY` = `true`
  - `NEXT_PUBLIC_PROXY_URL` = `https://anime-world-proxy.anime-world-proxy.workers.dev/proxy`
- **Local:** Same in `anime-world/.env.local`.

No code changes needed; the app already uses `NEXT_PUBLIC_PROXY_URL` when proxy is enabled.
