# Anime Village — Future Plan

Premium subscription, community features, and platform roadmap.

---

## Strategy

- **Platform:** Extend existing Next.js + Firebase stack; PWA first (no React Native until validated).
- **Monetization:** Binance Pay (USDT) only — no Stripe at launch.
- **Model:** Prepaid days (`premiumUntil`), not auto-renew.
- **Focus:** Status + convenience over complex tools.

---

## Premium Features

### Anime

- Ad-free playback
- 1080p / priority streams
- Unlimited watchlist
- Full watch history sync
- Continue watching across devices
- PiP + saved player settings (speed, quality)

### Manga

- Ad-free reading
- Bookmark sync
- Reading history

### Profile

- Custom theme (colors, banner)
- Display name on public page
- Public share link (`/u/username`)
- Custom URL (premium)

### Community

- Points system
- Ranks / levels
- Leaderboard
- Exclusive premium badges
- Profile frames
- 2× points multiplier

### Games

- Daily anime trivia
- Guess the character

---

## Free Tier

- Anime watch (with limits / ads)
- Basic profile
- Points + ranks (standard rate)
- Daily trivia

---

## Payments (Binance Pay)

| Plan    | Duration | Suggested price |
|---------|----------|-----------------|
| Monthly | 30 days  | $4–6 USDT       |
| Quarterly | 90 days | $12 USDT      |
| Yearly  | 365 days | $40 USDT       |

**Currency:** USDT (stable, widely held on Binance)

**Flow:**

1. User → `/premium` → Binance Pay checkout
2. Webhook confirms `PAY_SUCCESS`
3. Firebase: set `premiumUntil = now + duration`
4. Email reminder 3 days before expiry

**Firestore user fields:**

```ts
subscription: {
  tier: 'free' | 'premium',
  status: 'active' | 'expired',
  premiumUntil: Timestamp,
  binanceOrderId?: string,
}
```

**Optional later:** gift codes (manual sell → redeem on site), NOWPayments / CoinGate for extra coins.

---

## Build Order

1. **Points + ranks** — engagement base (comments, watch, daily login)
2. **Profile themes + public link** — shareable identity
3. **Binance Pay + premium gate** — validate conversion before more features
4. **Manga** — ad-free + sync for premium
5. **Daily trivia** — retention hook; premium bonus rewards

---

## Premium Gate (technical)

- Check `premiumUntil > Date.now()` in Firebase / custom claims
- Gate: stream quality, ads, manga, theme customization, badges, 2× points
- API routes: `/api/stream`, profile pages, manga routes

---

## Deferred (not v1)

- Short video editor (copyright / moderation risk)
- Voice / BYOK API (niche, low adoption)
- Full games arcade (high cost, low conversion)
- Stripe / card payments (add only if approved and needed)
- React Native app (after PWA + premium validated)
- Offline downloads

---

## Success Metrics

| Metric              | Target              |
|---------------------|---------------------|
| Paying conversion   | 1–3% of active users |
| Break-even          | ~50–200 subscribers |
| Time to first revenue | 2–4 months        |

---

## PWA (when ready)

- `manifest.json` + icons
- Service worker (cache shell + thumbnails, not full video)
- “Add to Home Screen” prompt on mobile
- `/premium` page + manage / extend subscription
