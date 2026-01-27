# Quick Start Guide - Production Deployment

## ⚡ 5-Minute Production Deployment

Follow these steps to deploy your anime streaming app in **under 5 minutes**!

---

## Prerequisites

- ✅ GitHub account
- ✅ Your code ready to deploy
- ✅ 5 minutes of your time

---

## Step 1: Push to GitHub (1 minute)

```bash
# In your anime-world directory
cd "D:\mywork\Anime world\anime-world"

git init
git add .
git commit -m "Production deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/anime-app.git
git push -u origin main
```

```bash
# In your aniwatch-api directory
cd "D:\mywork\Anime world\aniwatch-api"

git init
git add .
git commit -m "Production deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/anime-api.git
git push -u origin main
```

---

## Step 2: Deploy HiAnime API (2 minutes)

1. Go to [railway.app](https://railway.app) → Sign up with GitHub
2. New Project → Deploy from GitHub
3. Select `anime-api` repo
4. Wait for deployment (1-2 minutes)
5. **Copy the URL** (e.g., `https://anime-api.railway.app`)

---

## Step 3: Deploy Next.js App (2 minutes)

1. Go to [vercel.com](https://vercel.com) → Sign up with GitHub
2. New Project → Import `anime-app` repo
3. Framework: **Next.js**
4. Build command: `pnpm build`
5. Add Environment Variable:
   ```
   NEXT_PUBLIC_HIANIME_API_URL=YOUR_RAILWAY_URL_FROM_STEP_2
   ```
6. Click **Deploy**

---

## Step 4: Test Your App (30 seconds)

1. Open your Vercel URL (e.g., `https://anime-app.vercel.app`)
2. Browse anime
3. Click an episode
4. **Watch it play!** 🎉

---

## Health Check

Visit: `https://your-app.vercel.app/api/health`

Should show:
```json
{
  "status": "healthy",
  "services": {
    "hiAnime": "up",
    "proxy": "up"
  }
}
```

---

## If Something Goes Wrong

### HiAnime API not responding:
```bash
# Check Railway logs
# Dashboard → Your Project → Deployments → View Logs
```

### Videos won't play:
1. Check environment variable is set correctly
2. Test API directly: `YOUR_RAILWAY_URL/api/v2/hianime/home`
3. Try different anime (some may not be available)

### Build failed on Vercel:
1. Check build logs in Vercel dashboard
2. Make sure all dependencies are in `package.json`
3. Try deploying again

---

## You're Done! 🚀

Your app is now:
- ✅ Live and public
- ✅ Auto-scaling
- ✅ Free hosting
- ✅ HTTPS enabled
- ✅ Ready for users!

**Share your URL with friends and enjoy!**

---

## Next Steps (Optional)

- Add custom domain (Settings → Domains)
- Enable analytics (Vercel Analytics)
- Add Redis caching for better performance
- Monitor with health checks

---

## Cost: $0/month

Both Vercel and Railway have generous free tiers that should handle hundreds of users without any cost!
