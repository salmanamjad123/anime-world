# Ads Strategy — Anime Website

Use **Adsterra** as the publisher network. Google AdSense commonly rejects anime/streaming sites. Adsterra has no minimum traffic requirement and approves this niche.

Goal: earn from mixed global traffic (especially USA) **without** aggressive popups, 18+ ads, or betting ads.

---

## 1. What to use (and what to skip)

| Format | Use? | Why |
|---|---|---|
| Native banners | **Yes — primary** | Look like related content. Do not interrupt playback. |
| In-Page Push / Social Bar | **Yes — secondary** | Small slide-in widget. No browser permission popup. |
| On-click Smartlink | **Yes — home page, 3rd click / session** | Opens once per guest session on the home page (not first click). |
| Aggressive popunders | **No** | Interrupts watching. Hurts UX and return visits. |
| Auto popups / malware-style redirects | **No** | Against Adsterra policy and bad for users. |

### Native banners

- Place **under the video player** and **between episode lists**.
- Style them to match the site (same card size as related anime).
- USA users click native ads more than standard display banners.

### In-Page Push / Social Bar

- One small slide-in widget (chat-bubble / notification style).
- Do not request browser notification permission.
- Do not stack multiple social bars on the same page.

### On-click Smartlinks

On the **home page** only:

- Count guest clicks in the current browser session
- Open the Smartlink on the **3rd** click (not the 1st)
- Fire **once** per session; skip when the user is logged in
- Opens in a **new tab**; never fire on page load or on the watch page

---

## 2. Page layout

Keep ads around the player, not on top of it.

```
┌─────────────────────────────────────┐
│ Header / search                     │
├─────────────────────────────────────┤
│ Video player                        │  ← no overlay ads
│ Episode list                        │
│ Native banner (related-content look)│
├─────────────────────────────────────┤
│ Server / Download buttons           │
├─────────────────────────────────────┤
│ Native banner (optional, 1 more)    │
│ In-page push (1 widget, corner)     │
└─────────────────────────────────────┘
```

Home page: guest Smartlink opens once on the **3rd click** of the session (new tab).

Rules:

- Max **2 native banners** per page.
- Max **1** in-page push widget per page.
- Never cover the player, captions, or episode buttons.
- Do not auto-open extra tabs.

---

## 3. Block 18+ and betting ads

Do this **before** you put any ad code on the site.

1. Open [Adsterra Publisher](https://publishers.adsterra.com/).
2. Go to **Websites**.
3. Add the site, or edit an existing placement (**All Codes** / edit icon).
4. Find **Unallowed campaigns** (Exclusions).
5. Check:
   - **Erotic ads** — blocks 18+ / adult / dating
   - **Gambling ads** — blocks betting, casino, sports wagering
6. Save.

If a placement was created without these boxes, edit that placement, check both, and save. The live code updates; you do not need a new snippet.

---

## 4. Payment for Pakistan

PayPal is not a direct option in Pakistan. Adsterra pays **Net-15** (automatic, twice a month).

| Method | Minimum | When to use |
|---|---|---|
| **USDT (Tether) TRC-20** | $100 | **Main method.** Send to Binance, cash out to PKR via P2P. |
| Paxum | $5 | Early tests / small payouts. Then move to USDT. |
| Bank wire (IBAN / SWIFT) | $1,000 | High volume only. HBL, Meezan, Alfalah, UBL, etc. |
| Bitcoin | $100 | Skip. Fees are higher than USDT. |
| WebMoney | $5 | Skip. Access in Pakistan is unreliable. |

### Recommended setup

1. Start with **Paxum** only if you want a first small payout.
2. Switch to **USDT TRC-20 → Binance** as the default.
3. Use **bank wire** later if monthly revenue stays above $1,000.

---

## 5. Binance (USDT TRC-20)

### In Binance

1. Open **Wallet → Deposit**.
2. Select **USDT**.
3. Network: **TRON (TRC20)** only. Do **not** use ERC-20 (high fees; wrong network can lose funds).
4. Copy the deposit address (starts with `T`).

### In Adsterra

1. **Profile → Payment Info**.
2. Method: **Tether (USDT) TRC20**.
3. Paste the Binance TRC-20 address.
4. Save.

Payouts start after the **$100** threshold.

### Cash out to PKR

1. Wait until USDT arrives in Binance.
2. Open **P2P**.
3. Sell USDT to a verified buyer.
4. Receive PKR on EasyPaisa, JazzCash, or a local bank.

P2P safety:

- Use buyers with high completion rate and many trades.
- Release crypto only after PKR is in your account.
- Do not move the chat off Binance.

---

## 6. Expected earnings (rough)

Earnings depend on GEO and pages per visit, not unique users alone. USA traffic pays several times more than PK/IN traffic.

Assume **1,000 daily users × 3 pages = 3,000 pageviews**.

| Traffic mix | Site RPM (per 1,000 pageviews) | Daily | Monthly |
|---|---|---|---|
| Mostly PK / IN / BD | $0.80 – $2.00 | $2 – $6 | $72 – $180 |
| Mixed global | $2.00 – $4.50 | $6 – $14 | $180 – $405 |
| Heavy USA / UK / EU | $5.00 – $12.00+ | $15 – $36 | $450 – $1,080 |

These are estimates, not guarantees. Native + in-page push + on-click Smartlinks usually land in the mixed/USA range if a large share of visitors is from the US.

More pageviews (episode switches, related titles) raise impressions. Do not add extra ads just to inflate that number.

---

## 7. Setup checklist

- [ ] Create Adsterra publisher account and add the website
- [ ] On every placement, exclude **Erotic ads** and **Gambling ads**
- [ ] Add native banners under the player and in episode/related areas
- [ ] Add one in-page push / social bar
- [ ] Enable home Smartlink (3rd guest click / session); keep it off the watch page
- [ ] Do not use aggressive popunders
- [ ] Set payout to **USDT TRC-20** with the Binance deposit address
- [ ] Confirm a test deposit address is TRC-20 (`T…`) before the first payout
