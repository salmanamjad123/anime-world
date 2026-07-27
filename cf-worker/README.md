# Cloudflare Worker – HLS video proxy

Moves **video egress** off Railway. Keep Railway for search / episodes / sources only.

```
Browser  →  CF Worker /proxy  →  CDN (m3u8 + .ts)
Browser  →  Railway streaming-api  →  Anikoto / Megaplay metadata
```

## 1. Deploy the Worker

```bash
cd anime-world/cf-worker
npx wrangler login          # once — opens browser
npx wrangler deploy
```

Copy the URL from the output, e.g.:

`https://anime-world-proxy.<your-subdomain>.workers.dev`

Smoke test:

- `https://…workers.dev/` → JSON `{ ok: true }`
- `https://…workers.dev/proxy?url=https%3A%2F%2Fexample.com` → should not 404 the route

## 2. Point anime-world at Worker (keep Railway for API)

### Vercel (Production)

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_HIANIME_API_URL` | `https://streaming-api-july-production.up.railway.app` |
| `NEXT_PUBLIC_PROXY_URL` | `https://anime-world-proxy.<subdomain>.workers.dev/proxy` |
| `NEXT_PUBLIC_USE_PROXY` | `true` |

Then **Redeploy** Vercel (required for `NEXT_PUBLIC_*`).

### Local `.env`

```env
NEXT_PUBLIC_HIANIME_API_URL=https://streaming-api-july-production.up.railway.app
NEXT_PUBLIC_PROXY_URL=https://anime-world-proxy.<subdomain>.workers.dev/proxy
NEXT_PUBLIC_USE_PROXY=true
```

Restart `pnpm run dev`.

## 3. Verify cost drop

1. Play an episode on the site.
2. Network tab: `.m3u8` / `.ts` go to **`*.workers.dev/proxy`**, not Railway.
3. Railway Usage → Egress should flatten (API JSON only).

## Notes

- Do **not** remove Railway — the app still needs it for catalog + stream URLs.
- Leave the Worker meta/path as `/proxy` (matches `NEXT_PUBLIC_PROXY_URL`).
- Free Workers tier is usually enough at Hobby traffic; watch CF dashboard if you grow.
