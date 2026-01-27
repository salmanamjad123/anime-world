# 👨‍💻 Developer Quick Reference Guide

## 🚀 Getting Started

```bash
# 1. Install dependencies
pnpm install

# 2. Create .env.local file
# Copy from .env.local.example and add your Firebase credentials

# 3. Start development server
pnpm dev

# 4. Open browser
# http://localhost:3000
```

## 📂 Project Structure at a Glance

```
anime-world/
├── app/                    # Pages & API routes (Next.js App Router)
│   ├── page.tsx           # Homepage ✅ DONE
│   ├── layout.tsx         # Root layout ✅ DONE
│   └── api/               # Backend API routes ✅ DONE
│
├── components/            # React components
│   ├── ui/               # Base components ✅ DONE
│   ├── anime/            # Anime components ✅ DONE
│   ├── layout/           # Layout components ✅ DONE
│   └── providers/        # Context providers ✅ DONE
│
├── hooks/                # Custom React hooks ✅ DONE
├── store/                # Zustand stores ✅ DONE
├── lib/                  # Core libraries ✅ DONE
├── types/                # TypeScript types ✅ DONE
└── constants/            # App constants ✅ DONE
```

## 🔥 Common Code Patterns

### 1. Fetching Anime Data

```typescript
'use client';

import { useTrendingAnime } from '@/hooks/useAnime';
import { AnimeGrid } from '@/components/anime/AnimeGrid';

export default function MyPage() {
  const { data, isLoading, error } = useTrendingAnime(1, 20);
  const anime = data?.data?.Page?.media || [];

  if (error) return <div>Error: {error.message}</div>;
  
  return <AnimeGrid anime={anime} isLoading={isLoading} />;
}
```

### 2. Adding to Watchlist

```typescript
'use client';

import { useWatchlistStore } from '@/store/useWatchlistStore';
import { Button } from '@/components/ui/Button';

export function WatchlistButton({ anime }: { anime: Anime }) {
  const { addToWatchlist, removeFromWatchlist, isInWatchlist } = useWatchlistStore();
  const inWatchlist = isInWatchlist(anime.id);

  const handleToggle = () => {
    if (inWatchlist) {
      removeFromWatchlist(anime.id);
    } else {
      addToWatchlist(anime.id, anime.title.english || anime.title.romaji, anime.coverImage.large);
    }
  };

  return (
    <Button onClick={handleToggle}>
      {inWatchlist ? 'Remove from Watchlist' : 'Add to Watchlist'}
    </Button>
  );
}
```

### 3. Tracking Watch Progress

```typescript
'use client';

import { useHistoryStore } from '@/store/useHistoryStore';

export function VideoPlayer({ anime, episode }: Props) {
  const { updateProgress } = useHistoryStore();

  const handleProgress = (currentTime: number, duration: number) => {
    updateProgress(
      anime.id,
      episode.id,
      episode.number,
      currentTime,
      duration,
      anime.title,
      anime.coverImage.large,
      episode.title
    );
  };

  // Use in your video player's onTimeUpdate event
  return <video onTimeUpdate={(e) => {
    const video = e.currentTarget;
    handleProgress(video.currentTime, video.duration);
  }} />;
}
```

### 4. Creating a New Page

```typescript
// app/my-page/page.tsx
'use client';

import { Header } from '@/components/layout/Header';

export default function MyPage() {
  return (
    <div className="min-h-screen bg-gray-900">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-white mb-6">My Page</h1>
        {/* Your content here */}
      </main>
    </div>
  );
}
```

### 5. Creating an API Route

```typescript
// app/api/my-endpoint/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');

    // Your logic here
    const data = await fetchSomeData(query);

    return NextResponse.json(data);
  } catch (error) {
    console.error('[API Error]', error);
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}
```

### 6. Using Theme Toggle

```typescript
'use client';

import { useThemeStore } from '@/store/useThemeStore';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button onClick={toggleTheme}>
      {theme === 'dark' ? <Sun /> : <Moon />}
    </button>
  );
}
```

### 7. Searching Anime

```typescript
'use client';

import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import { useSearchAnime } from '@/hooks/useAnime';

export function SearchPage() {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  
  const { data, isLoading } = useSearchAnime(
    { search: debouncedQuery },
    1,
    20
  );

  const results = data?.data?.Page?.media || [];

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search anime..."
      />
      <AnimeGrid anime={results} isLoading={isLoading} />
    </div>
  );
}
```

### 8. Fetching Episodes

```typescript
'use client';

import { useEpisodes } from '@/hooks/useEpisodes';
import { useState } from 'react';

export function EpisodeList({ animeId }: { animeId: string }) {
  const [isDub, setIsDub] = useState(false);
  const { data, isLoading } = useEpisodes(animeId, isDub);

  const episodes = data?.episodes || [];

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button onClick={() => setIsDub(false)}>Sub</button>
        <button onClick={() => setIsDub(true)}>Dub</button>
      </div>
      
      {episodes.map((ep) => (
        <div key={ep.id}>Episode {ep.number}</div>
      ))}
    </div>
  );
}
```

### 9. Getting Streaming Sources

```typescript
'use client';

import { useStreamingSourcesWithFallback } from '@/hooks/useStream';

export function VideoPlayer({ episodeId }: { episodeId: string }) {
  const { data, isLoading, error } = useStreamingSourcesWithFallback(episodeId);

  if (isLoading) return <div>Loading video...</div>;
  if (error) return <div>Error loading video</div>;

  const videoUrl = data?.sources[0]?.url;

  return (
    <video controls>
      <source src={videoUrl} type="application/x-mpegURL" />
    </video>
  );
}
```

## 🎨 Styling Patterns

### Using Tailwind with cn() utility

```typescript
import { cn } from '@/lib/utils';

// Conditional classes
<div className={cn(
  'base-class',
  isActive && 'active-class',
  'another-class'
)} />

// Merge conflicting classes (Tailwind)
<div className={cn(
  'px-4 py-2',      // This will be kept
  'px-6',           // This overrides px-4
  className         // Props override internal styles
)} />
```

### Common Tailwind Patterns

```typescript
// Responsive grid
<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">

// Center content
<div className="flex items-center justify-center min-h-screen">

// Card with hover
<div className="bg-gray-800 rounded-lg p-4 hover:bg-gray-700 transition-colors">

// Gradient text
<h1 className="bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">

// Glass morphism
<div className="bg-white/10 backdrop-blur-md border border-white/20">
```

## 🔑 Key Files to Know

### Must-Know Files

1. **`app/layout.tsx`** - Root layout with providers
2. **`app/page.tsx`** - Homepage
3. **`lib/api/anilist.ts`** - AniList API client
4. **`lib/api/consumet.ts`** - Consumet API client
5. **`types/index.ts`** - All TypeScript types
6. **`constants/routes.ts`** - Route paths
7. **`lib/utils.ts`** - Utility functions

### Configuration Files

1. **`.env.local`** - Environment variables (create from .example)
2. **`package.json`** - Dependencies
3. **`tsconfig.json`** - TypeScript config
4. **`next.config.ts`** - Next.js config

## 🛠️ Useful Commands

```bash
# Development
pnpm dev              # Start dev server
pnpm build           # Build for production
pnpm start           # Start production server
pnpm lint            # Run ESLint

# Package management
pnpm add <package>   # Add dependency
pnpm remove <pkg>    # Remove dependency

# Clear cache (if needed)
rm -rf .next
rm -rf node_modules
pnpm install
```

## 🧪 Testing Data Flow

### Test Anime API

```bash
# Open browser console on homepage
# Check network tab for these requests:

GET /api/anime?type=trending&page=1&perPage=18
GET /api/anime?type=popular&page=1&perPage=18
```

### Test Watchlist

```javascript
// Open browser console and run:
const { addToWatchlist } = useWatchlistStore.getState();
addToWatchlist('12345', 'Test Anime', 'https://image.url');

// Check localStorage
localStorage.getItem('anime-watchlist');
```

### Test Theme

```javascript
// Open browser console and run:
const { toggleTheme } = useThemeStore.getState();
toggleTheme();
```

## 📋 Checklist for New Features

When adding a new feature:

- [ ] Define types in `types/`
- [ ] Create API route in `app/api/` (if needed)
- [ ] Create custom hook in `hooks/`
- [ ] Create Zustand store in `store/` (if state needed)
- [ ] Create components in `components/`
- [ ] Create page in `app/`
- [ ] Test in browser
- [ ] Check for errors in console

## 🐛 Common Debugging Tips

### Issue: Page shows "use client" error

**Solution:** Add `'use client';` at the top of the file if using hooks or state

### Issue: Types not found

**Solution:** 
```typescript
// Use absolute imports
import { Anime } from '@/types';  // ✅ Good
import { Anime } from '../types'; // ❌ Avoid
```

### Issue: Env variables not working

**Solution:**
- Restart dev server after changing `.env.local`
- Make sure variables start with `NEXT_PUBLIC_` for client-side
- Check for typos

### Issue: Styles not applying

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next
pnpm dev
```

### Issue: Can't fetch data

**Solution:**
- Check network tab in browser DevTools
- Check console for errors
- Verify API route is correct
- Check if AniList/Consumet API is accessible

## 🎯 Next Steps (What to Build)

### Priority 1: Core Functionality
1. **Anime Detail Page** (`app/anime/[id]/page.tsx`)
2. **Watch Page** (`app/watch/[animeId]/[episodeId]/page.tsx`)
3. **Video Player Component** (`components/player/VideoPlayer.tsx`)

### Priority 2: User Features
4. **Search Page** (`app/search/page.tsx`)
5. **Watchlist Page** (`app/watchlist/page.tsx`)
6. **History Page** (`app/history/page.tsx`)

### Priority 3: Polish
7. Authentication UI
8. Advanced filters
9. Recommendations

## 📚 Learning Resources

- **Next.js Docs**: https://nextjs.org/docs
- **TanStack Query**: https://tanstack.com/query/latest/docs/react/overview
- **Zustand**: https://docs.pmnd.rs/zustand/getting-started/introduction
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

## 💡 Pro Tips

1. **Always use TypeScript types** - They help catch bugs early
2. **Use React Query for server data** - Zustand for client state
3. **Keep components small** - One responsibility per component
4. **Test in mobile view** - Use Chrome DevTools responsive mode
5. **Read error messages** - They usually tell you exactly what's wrong
6. **Check the console** - Most errors show up there first

---

**Need help?** Check README.md, SETUP.md, or ARCHITECTURE.md for more details!
