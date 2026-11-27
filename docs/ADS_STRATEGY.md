# Ads Strategy — Anime Website

Use **HilltopAds** as the publisher network for `animevillage.my`.

Goal: earn from mixed global traffic with Hilltop formats (MultiTag banner 300×250, MultiTag combo, popunder).

---

## 1. What we use

| Format | Use? | Where |
|---|---|---|
| Banner 300×250 | **Yes** | Home strip/grid, synopsis, manga grid, under player |
| MultiTag (site-wide) | **Yes** | Once in root layout |
| Popunder (script + click URL) | **Yes** | Site-wide; 2h cooldown on click URL |
| In-Page Push / Social Bar | **No** on animevillage.my | Left off |
| Video Slider / VAST | **No** | Not in current layout |

### Env vars

```
NEXT_PUBLIC_HILLTOP_BANNER_SRC=
NEXT_PUBLIC_HILLTOP_MULTITAG_SRC=
NEXT_PUBLIC_HILLTOP_POPUNDER_SRC=
NEXT_PUBLIC_HILLTOP_POPUNDER_URL=
```

---

## 2. Rules

- Prefer **1–2** in-content banners per page (admin can toggle placements).
- Never cover the player, captions, or episode buttons.
- Popunder click URL respects a **2 hour** client cooldown; script injects once per tab session.

---

## 3. Admin

`/admin/ads` toggles global ads, hide-for-logged-in, per-placement visibility, and per-user exemptions.

---

## 4. Checklist

- [x] Verify website in HilltopAds
- [x] Create Banner / MultiTag / Popunder zones
- [x] Wire env + components (remove Adsterra)
- [ ] Deploy and set the same env on Vercel production
- [ ] Confirm scripts load on production
