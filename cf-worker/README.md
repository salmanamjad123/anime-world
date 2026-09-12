# Cloudflare Worker – HLS video proxy (optional)

Moves **video egress** off Railway. Keep Railway for search / episodes / sources.

**Preferred production setup:** use Railway’s built-in proxy instead — fewer 502s on rotating Megaplay CDNs (`megap.*`, `imgnex`, etc.):

```env
NEXT_PUBLIC_HIANIME_API_URL=https://streaming-api-july-production.up.railway.app
NEXT_PUBLIC_PROXY_URL=https://streaming-api-july-production.up.railway.app/api/v2/proxy
NEXT_PUBLIC_USE_PROXY=true
```

`anime-world`’s `getHlsProxyBase()` already prefers Railway when `HIANIME` is a Railway URL, even if `PROXY_URL` still points at this Worker.

Use this Worker only if Railway egress cost is a problem and you’ve verified the Worker can reach current Megaplay hosts.

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

## 2. Point anime-world at Worker (optional)

### Vercel (Production)

| Name | Value |
|------|--------|
| `NEXT_PUBLIC_HIANIME_API_URL` | `https://streaming-api-july-production.up.railway.app` |
| `NEXT_PUBLIC_PROXY_URL` | `https://anime-world-proxy.<subdomain>.workers.dev/proxy` |
| `NEXT_PUBLIC_USE_PROXY` | `true` |

Then **Redeploy** Vercel (required for `NEXT_PUBLIC_*`).

### Local `.env`

Prefer local/Railway proxy for Megaplay Referer:

```env
NEXT_PUBLIC_HIANIME_API_URL=http://localhost:4000
NEXT_PUBLIC_PROXY_URL=http://localhost:4000/api/v2/proxy
NEXT_PUBLIC_USE_PROXY=true
```

## 3. Verify cost drop (if using Worker)

1. Play an episode on the site.
2. Network tab: `.m3u8` / `.ts` go to **`*.workers.dev/proxy`**, not Railway.
3. Railway Usage → Egress should flatten (API JSON only).

## Notes

- Do **not** remove Railway — the app still needs it for catalog + stream URLs.
- Leave the Worker meta/path as `/proxy` (matches `NEXT_PUBLIC_PROXY_URL`).
- Free Workers tier is usually enough at Hobby traffic; watch CF dashboard if you grow.
- Header retries include Megaplay edge CDNs (`megap.norami.top`, `ncdn.imgnex.top`, etc.).
