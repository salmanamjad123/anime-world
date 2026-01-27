# Production Deployment Guide

## 🚀 Deploy Your Anime Streaming App (Production-Ready)

This guide will help you deploy your app to handle **100-1000+ concurrent users** for **FREE** (or minimal cost).

---

## Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   Browser   │─────▶│  Vercel      │─────▶│  Railway    │
│   (Users)   │      │  (Next.js)   │      │  (HiAnime)  │
└─────────────┘      └──────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Upstash    │
                     │   (Redis)    │
                     └──────────────┘
```

---

## Step 1: Deploy HiAnime API to Railway

### 1.1 Prepare HiAnime API Repository

```bash
cd "D:\mywork\Anime world\aniwatch-api"

# Initialize git (if not already)
git init
git add .
git commit -m "Initial commit for production"

# Create GitHub repo and push
# Go to github.com → New Repository → "anime-hianime-api"
git remote add origin https://github.com/YOUR_USERNAME/anime-hianime-api.git
git branch -M main
git push -u origin main
```

### 1.2 Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub (FREE)
3. Click "New Project"
4. Select "Deploy from GitHub repo"
5. Choose your `anime-hianime-api` repository
6. Railway will auto-detect it's a Node.js app
7. Click "Deploy"

### 1.3 Configure Environment Variables (Railway)

In Railway dashboard:
- Go to Variables tab
- Add: `NODE_ENV=production`
- Add: `PORT=4000`

### 1.4 Get Your API URL

After deployment, Railway will give you a URL like:
```
https://anime-hianime-api-production.up.railway.app
```

**Copy this URL** - you'll need it for Step 2!

---

## Step 2: Deploy Next.js to Vercel

### 2.1 Prepare Your Repository

```bash
cd "D:\mywork\Anime world\anime-world"

# Initialize git (if not already)
git init
git add .
git commit -m "Production ready deployment"

# Create GitHub repo and push
# Go to github.com → New Repository → "anime-streaming-app"
git remote add origin https://github.com/YOUR_USERNAME/anime-streaming-app.git
git branch -M main
git push -u origin main
```

### 2.2 Deploy to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub (FREE)
3. Click "Add New Project"
4. Import your `anime-streaming-app` repository
5. Configure project:
   - **Framework Preset**: Next.js
   - **Build Command**: `pnpm build`
   - **Install Command**: `pnpm install`
6. Add Environment Variables:

```env
NEXT_PUBLIC_HIANIME_API_URL=https://YOUR_RAILWAY_URL_HERE

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Caching
ENABLE_PROXY_CACHE=true
PROXY_CACHE_MAX_AGE=3600

# Features
ENABLE_VIDEO_PROXY=true
ENABLE_FALLBACK_PROVIDERS=true
ENABLE_RATE_LIMITING=true

# Error Handling
MAX_RETRY_ATTEMPTS=3
RETRY_DELAY_MS=1000
```

7. Click "Deploy"

Your app will be live at:
```
https://your-app-name.vercel.app
```

---

## Step 3: (Optional) Add Redis Caching

For better performance with more users:

### 3.1 Create Upstash Redis

1. Go to [upstash.com](https://upstash.com)
2. Sign up (FREE tier available)
3. Create new database:
   - Name: `anime-cache`
   - Region: Choose closest to your Railway region
4. Copy Connection URL and Token

### 3.2 Add to Vercel Environment Variables

```env
UPSTASH_REDIS_URL=https://your-redis-url
UPSTASH_REDIS_TOKEN=your_token_here
```

### 3.3 Update Cache Implementation

Install Redis client:
```bash
pnpm add @upstash/redis
```

Then update `lib/cache/memory-cache.ts` to use Redis (optional - current memory cache works fine for smaller scale).

---

## Step 4: Configure Custom Domain (Optional)

### On Vercel:
1. Go to Project Settings → Domains
2. Add your custom domain (e.g., `animehub.com`)
3. Update DNS records as instructed
4. Vercel provides FREE SSL certificate

---

## Step 5: Monitor Your Deployment

### Check Health:
- **Vercel Dashboard**: View deployment logs, bandwidth usage
- **Railway Dashboard**: Monitor API uptime, memory usage

### Monitor Errors:
Add Sentry (optional, free tier):
1. Sign up at [sentry.io](https://sentry.io)
2. Get DSN
3. Add to Vercel env: `NEXT_PUBLIC_SENTRY_DSN=your_dsn`

---

## Performance Expectations

### With Free Tiers:

| Metric | Expected Performance |
|--------|---------------------|
| **Concurrent Users** | 100-500 users |
| **Daily Users** | 5,000-10,000 users |
| **Video Loading** | 2-5 seconds |
| **API Response** | 1-3 seconds |
| **Uptime** | 99%+ |
| **Cost** | $0/month |

### Scaling Up:

If you exceed free tier limits:
- **Railway**: $5-20/month for 500+ users
- **Upstash**: $10/month for unlimited caching
- **Vercel**: $20/month for team features (optional)

---

## Troubleshooting

### Issue: HiAnime API is slow
**Solution**: 
- Railway free tier sleeps after inactivity
- Upgrade to Hobby plan ($5/month) for always-on
- Or use a cron job to keep it awake

### Issue: Videos won't play
**Solutions**:
1. Check HiAnime API is running: `https://your-railway-url/api/v2/hianime/home`
2. Check CORS headers in proxy route
3. Try different anime (some may not be available)
4. Check browser console for errors

### Issue: Rate limiting errors
**Solution**:
- Increase `RATE_LIMIT_MAX_REQUESTS` in environment variables
- Or disable rate limiting temporarily: `ENABLE_RATE_LIMITING=false`

### Issue: Memory issues
**Solution**:
- Railway free tier: 512MB RAM
- Upgrade to Hobby plan: 8GB RAM
- Or optimize memory usage with Redis caching

---

## Security Checklist

- ✅ Rate limiting enabled
- ✅ CORS properly configured
- ✅ Environment variables secured
- ✅ HTTPS enabled (automatic with Vercel)
- ✅ No API keys in code
- ✅ Error messages don't expose internals

---

## Continuous Deployment

Both Vercel and Railway support automatic deployments:

1. Push to GitHub main branch
2. Automatically builds and deploys
3. Zero downtime deployments
4. Rollback support

```bash
# Make changes
git add .
git commit -m "Add new feature"
git push origin main

# Vercel and Railway automatically deploy!
```

---

## Cost Breakdown

### Free Forever:
- Vercel: ✅ Unlimited (with fair use)
- Railway: ✅ $5 free credit/month (~500 hours)
- Upstash: ✅ 10K requests/day
- **Total: $0/month for ~500 users**

### If You Exceed Free Tier:
- Railway Hobby: $5/month (always-on + more resources)
- Upstash Pro: $10/month (unlimited requests)
- **Total: $15/month for 1000+ users**

---

## Success Metrics

After deployment, monitor:
- ✅ User count (Vercel Analytics)
- ✅ API response times (Railway metrics)
- ✅ Error rates (Vercel logs)
- ✅ Video playback success rate
- ✅ Bandwidth usage

---

## Next Steps

1. ✅ Deploy HiAnime API to Railway
2. ✅ Deploy Next.js to Vercel
3. ✅ Test with real users
4. ⏭️ Add analytics (Google Analytics)
5. ⏭️ Add user accounts (optional)
6. ⏭️ Add comments/reviews (optional)

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Railway application logs
3. Test HiAnime API directly
4. Check browser console errors
5. Review this deployment guide

**Your app is now production-ready! 🚀**
