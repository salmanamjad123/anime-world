# 🚀 Setup Guide

Complete guide to setting up the Anime World project.

## Prerequisites

- **Node.js** 18.x or higher
- **pnpm** (recommended), npm, or yarn
- **Git** for version control
- **Firebase Account** (for user features)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Navigate to project directory
cd "d:\mywork\Anime world\anime-world"

# Install dependencies
pnpm install
# or
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Copy the example file
cp .env.local.example .env.local
```

Edit `.env.local` with your Firebase credentials:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_actual_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 3. Set Up Firebase (Optional but Recommended)

#### Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Enter project name: `anime-world` (or your choice)
4. Disable Google Analytics (optional for FYP)
5. Click "Create project"

#### Enable Authentication

1. In Firebase Console, go to **Authentication**
2. Click "Get started"
3. Enable **Email/Password** sign-in method
4. (Optional) Enable **Google** sign-in if you want social login

#### Create Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click "Create database"
3. Start in **Test mode** (for development)
4. Choose a location (closest to your users)
5. Click "Enable"

#### Get Firebase Config

1. Go to **Project Settings** (gear icon)
2. Scroll to "Your apps"
3. Click the **Web icon** (`</>`)
4. Register app with nickname: `Anime World Web`
5. Copy the `firebaseConfig` object values to your `.env.local`

### 4. Run Development Server

```bash
pnpm dev
# or
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Verify Setup

✅ **Check if everything works:**

- [ ] Homepage loads with trending anime
- [ ] Theme toggle works (dark/light)
- [ ] Navigation links are clickable
- [ ] No console errors

## Common Issues & Solutions

### Issue: "Failed to fetch anime"

**Cause:** AniList API or Consumet API is unreachable

**Solution:**
- Check your internet connection
- AniList API might be rate-limited (90 requests/minute)
- Try again after a few minutes

### Issue: "Firebase is not configured"

**Cause:** Missing or incorrect Firebase environment variables

**Solution:**
- Verify all `NEXT_PUBLIC_FIREBASE_*` variables in `.env.local`
- Restart the dev server after changing `.env.local`
- Check for typos in variable names

### Issue: Module not found errors

**Cause:** Dependencies not installed or path issues

**Solution:**
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# or with npm
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port 3000 already in use

**Solution:**
```bash
# Run on different port
pnpm dev -- -p 3001

# Or kill process on port 3000 (Windows PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process

# Or kill process on port 3000 (Mac/Linux)
lsof -ti:3000 | xargs kill
```

### Issue: Tailwind styles not working

**Solution:**
- Clear Next.js cache: `rm -rf .next`
- Restart dev server
- Check if `globals.css` is imported in `layout.tsx`

## Project Structure Overview

```
anime-world/
├── app/                    # Next.js pages and API routes
├── components/             # React components
├── hooks/                  # Custom React hooks
├── lib/                    # Core libraries (API clients, Firebase, utils)
├── store/                  # Zustand state stores
├── types/                  # TypeScript type definitions
└── constants/              # Constants and configuration
```

## Next Steps

1. **Test the application**
   - Browse trending anime
   - Search for anime
   - Test watchlist features

2. **Customize the project**
   - Update colors in Tailwind config
   - Add your own branding
   - Implement additional features

3. **Deploy to production**
   - See `DEPLOYMENT.md` (create this later)

## Development Commands

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linter
pnpm lint

# Type check
pnpm tsc --noEmit
```

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes* | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes* | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes* | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes* | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes* | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes* | Firebase app ID |
| `NEXT_PUBLIC_ANILIST_API_URL` | No | AniList API URL (has default) |
| `NEXT_PUBLIC_CONSUMET_API_URL` | No | Consumet API URL (has default) |

\* Required only if you want user authentication and cloud sync features. The app works without Firebase (localStorage only).

## Support

If you encounter issues:

1. Check the console for error messages
2. Review the README.md for project documentation
3. Check Firebase Console for service status
4. Verify API endpoints are accessible

---

Happy coding! 🎉
