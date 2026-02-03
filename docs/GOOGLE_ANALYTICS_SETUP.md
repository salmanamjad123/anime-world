# Google Analytics 4 Setup Guide

Track visitors, page views, and traffic sources on Anime Village.

## Step 1: Create a GA4 Property

1. Go to [analytics.google.com](https://analytics.google.com)
2. Sign in with your Google account
3. Click **Admin** (gear icon, bottom left)
4. Under **Property**, click **Create property**
5. Enter:
   - **Property name:** Anime Village
   - **Reporting time zone:** Your timezone
   - **Currency:** Your currency
6. Click **Next** → Complete business details → **Create**

## Step 2: Create a Web Data Stream

1. Select **Web** as the platform
2. Enter:
   - **Website URL:** `https://animevillage.org`
   - **Stream name:** Anime Village (or leave default)
3. Click **Create stream**
4. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

## Step 3: Add to Environment Variables

### Local (.env.local)

```env
NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

Replace `G-XXXXXXXXXX` with your actual Measurement ID.

### Vercel (Production)

1. Go to [vercel.com](https://vercel.com) → Your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `NEXT_PUBLIC_GA_ID`
   - **Value:** `G-XXXXXXXXXX`
   - **Environment:** Production (and Preview if you want)
3. Click **Save**
4. **Redeploy** your project for the change to take effect

## Step 4: Verify It Works

1. Deploy your site
2. Visit your site
3. In Google Analytics: **Reports** → **Realtime** → You should see your visit within ~30 seconds

## What You See in GA4

| Report | What it shows |
|--------|---------------|
| **Realtime** | Active users right now |
| **Acquisition** | Where visitors come from (search, direct, social) |
| **Engagement** | Page views, events, sessions |
| **Pages and screens** | Most visited pages |

## Troubleshooting

- **No data?** Wait 24–48 hours; some reports take time to populate
- **Realtime empty?** Check that `NEXT_PUBLIC_GA_ID` is set in Vercel and you redeployed
- **Ad blocker?** Disable ad blockers when testing; they block GA
