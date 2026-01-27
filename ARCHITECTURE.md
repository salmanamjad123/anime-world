# 🏛️ Architecture Documentation

Understanding the Anime World codebase structure and design decisions.

## Overview

Anime World is built with a **layered architecture** that separates concerns and makes the codebase maintainable and scalable.

```
┌─────────────────────────────────────────┐
│          User Interface (UI)            │
│         React Components                │
├─────────────────────────────────────────┤
│       Business Logic Layer              │
│    Custom Hooks + Zustand Stores        │
├─────────────────────────────────────────┤
│         Data Fetching Layer             │
│    TanStack Query + Next.js API         │
├─────────────────────────────────────────┤
│        External Services Layer          │
│  AniList API | Consumet API | Firebase  │
└─────────────────────────────────────────┘
```

## Layers Explained

### 1. UI Layer (`components/`)

**Purpose:** Presentation and user interaction

**Structure:**
```
components/
├── ui/              # Base UI components (Button, Card, Input)
├── anime/           # Anime-specific components (AnimeCard, AnimeGrid)
├── player/          # Video player components
├── layout/          # Layout components (Header, Footer)
└── providers/       # Context providers (Query, Theme, Auth)
```

**Guidelines:**
- Components should be **presentational** (no direct API calls)
- Use hooks from `hooks/` for data and stores from `store/` for state
- Keep components small and focused on one responsibility

### 2. Business Logic Layer (`hooks/` + `store/`)

**Purpose:** Application logic, state management, and data operations

#### Custom Hooks (`hooks/`)

React hooks that encapsulate data fetching and business logic:

```typescript
// Example: useAnime.ts
export function useTrendingAnime(page = 1) {
  return useQuery({
    queryKey: ['trending', page],
    queryFn: () => fetch(`/api/anime?type=trending&page=${page}`),
  });
}
```

**Key hooks:**
- `useAnime.ts` - Anime data fetching
- `useEpisodes.ts` - Episode data fetching
- `useStream.ts` - Streaming sources
- `useMediaQuery.ts` - Responsive design
- `useDebounce.ts` - Debounced values

#### State Stores (`store/`)

Zustand stores for **client-side state** with localStorage persistence:

```typescript
// Example: useWatchlistStore.ts
export const useWatchlistStore = create(
  persist(
    (set) => ({
      watchlist: [],
      addToWatchlist: (anime) => set(...),
    }),
    { name: 'anime-watchlist' }
  )
);
```

**Key stores:**
- `useWatchlistStore` - User's watchlist
- `useHistoryStore` - Watch history with timestamps
- `usePlayerStore` - Video player preferences
- `useThemeStore` - Theme (dark/light)
- `useUserStore` - User authentication state

### 3. Data Fetching Layer (`app/api/`)

**Purpose:** Backend API routes that proxy external services

**Why this layer?**
- Hide API keys and sensitive logic
- Handle rate limiting
- Transform data before sending to frontend
- CORS handling
- Error handling in one place

**Structure:**
```
app/api/
├── anime/
│   ├── route.ts           # GET /api/anime (list anime)
│   └── [id]/route.ts      # GET /api/anime/[id] (anime details)
├── search/route.ts        # GET /api/search (search anime)
├── episodes/
│   └── [animeId]/
│       ├── route.ts       # GET /api/episodes/[animeId]
│       └── info/route.ts  # GET /api/episodes/[animeId]/info
└── stream/
    └── [episodeId]/route.ts # GET /api/stream/[episodeId]
```

**Example Flow:**
```
1. User visits homepage
2. Component calls useTrendingAnime()
3. Hook calls fetch('/api/anime?type=trending')
4. Next.js API route /api/anime/route.ts handles request
5. API route calls lib/api/anilist.ts
6. AniList client makes GraphQL request
7. Data flows back through layers to component
```

### 4. External Services Layer (`lib/api/` + `lib/firebase/`)

**Purpose:** Communicate with external APIs and services

#### API Clients (`lib/api/`)

**AniList Client (`lib/api/anilist.ts`):**
- Fetches anime metadata (titles, descriptions, images, scores)
- Uses GraphQL
- Data source: MyAnimeList database

**Consumet Client (`lib/api/consumet.ts`):**
- Fetches streaming sources (video URLs)
- Provides episode lists with sub/dub info
- Multiple provider support (Gogoanime, Zoro, etc.)

**Key functions:**
```typescript
// AniList
getTrendingAnime(page, perPage)
getPopularAnime(page, perPage)
searchAnime(filters, page, perPage)
getAnimeById(id)

// Consumet
getAnimeInfo(anilistId)
getEpisodes(anilistId, provider, dub)
getStreamingSources(episodeId, provider)
```

#### Firebase Services (`lib/firebase/`)

**Authentication (`lib/firebase/auth.ts`):**
- Sign up/sign in/sign out
- User profile management
- Auth state listener

**Firestore (`lib/firebase/firestore.ts`):**
- Save watchlist to cloud
- Sync watch history
- User preferences

## Data Flow Patterns

### Pattern 1: Fetching and Displaying Anime

```
Homepage Component
    ↓
useTrendingAnime() hook
    ↓
TanStack Query (useQuery)
    ↓
fetch('/api/anime?type=trending')
    ↓
Next.js API Route (/app/api/anime/route.ts)
    ↓
getTrendingAnime() from anilist.ts
    ↓
AniList GraphQL API
    ↓
Data flows back through layers
    ↓
TanStack Query caches result
    ↓
Component renders AnimeGrid
```

### Pattern 2: Adding to Watchlist

```
User clicks "Add to Watchlist" button
    ↓
Component calls addToWatchlist() from store
    ↓
useWatchlistStore updates state
    ↓
State persisted to localStorage automatically
    ↓
If user is logged in:
    ↓
    addToWatchlist() from firestore.ts
    ↓
    Syncs to Firebase Firestore
```

### Pattern 3: Playing an Episode

```
User clicks episode
    ↓
Navigate to /watch/[animeId]/[episodeId]
    ↓
Watch page loads
    ↓
useStreamingSources(episodeId) hook
    ↓
fetch('/api/stream/[episodeId]')
    ↓
Next.js API route
    ↓
getStreamingSources() from consumet.ts
    ↓
Consumet API returns .m3u8 URLs
    ↓
VideoPlayer component receives URLs
    ↓
HLS.js plays the video
```

## Type System (`types/`)

**Centralized TypeScript types** ensure consistency across the application.

```typescript
// Example: types/anime.ts
export interface Anime {
  id: string;
  title: {
    romaji: string;
    english?: string;
    native?: string;
  };
  coverImage: {
    large: string;
    medium: string;
  };
  // ... more fields
}
```

**Benefits:**
- Autocomplete in IDE
- Catch errors at compile time
- Self-documenting code
- Refactoring safety

## Utility Functions (`lib/utils.ts`)

Shared helper functions used throughout the app:

```typescript
cn()                    // Merge Tailwind classes
formatNumber()          // 1200 → "1.2K"
formatTime()            // 3665 → "1:01:05"
getPreferredTitle()     // Get English or Romaji title
truncateText()          // Truncate with ellipsis
// ... more
```

## Constants (`constants/`)

**Centralized configuration** prevents magic numbers and strings:

```typescript
// constants/api.ts
export const ANILIST_API_URL = 'https://graphql.anilist.co';
export const CACHE_DURATIONS = {
  ANIME_LIST: 300,      // 5 minutes
  ANIME_DETAIL: 600,    // 10 minutes
};

// constants/routes.ts
export const ROUTES = {
  HOME: '/',
  ANIME_DETAIL: (id) => `/anime/${id}`,
  WATCH: (animeId, episodeId) => `/watch/${animeId}/${episodeId}`,
};
```

## Key Design Decisions

### 1. Why TanStack Query?

- **Automatic caching** - Reduces API calls
- **Background refetching** - Data stays fresh
- **Loading and error states** - Built-in
- **Deduplication** - Same query = one request

### 2. Why Zustand over Context API?

- **Simpler API** - Less boilerplate
- **Better performance** - No unnecessary re-renders
- **Persistence middleware** - localStorage built-in
- **DevTools** - Easy debugging

### 3. Why Next.js API Routes?

- **Security** - Hide API keys
- **Rate limiting** - Control request frequency
- **Caching** - Server-side caching
- **CORS** - No CORS issues

### 4. Why Firebase?

- **Free tier** - Good for FYP
- **Real-time** - Instant sync across devices
- **Authentication** - Built-in user management
- **Scalable** - Can handle production traffic

## Performance Optimizations

1. **Image optimization** - Next.js `<Image>` component
2. **Code splitting** - Automatic in Next.js
3. **React Query caching** - Minimize API calls
4. **Lazy loading** - Load components on demand
5. **Skeleton loaders** - Better perceived performance

## Security Considerations

1. **API routes** - External APIs never called from client
2. **Environment variables** - API keys in `.env.local`
3. **Firebase rules** - Firestore security rules (must set up)
4. **Input validation** - Validate user input
5. **XSS prevention** - React automatically escapes

## Testing Strategy (Future)

```
Unit Tests       → Test utility functions
Component Tests  → Test UI components in isolation
Integration      → Test hooks with mocked APIs
E2E Tests        → Test full user flows
```

## Scalability Considerations

**Current architecture supports:**
- ✅ Adding new anime providers (new API client)
- ✅ Adding new features (new pages, components)
- ✅ Multiple languages (i18n ready structure)
- ✅ Mobile app (React Native can reuse hooks/stores)

## Folder Organization Principles

1. **Group by feature** - Related files together
2. **Layered structure** - Clear separation of concerns
3. **Consistent naming** - PascalCase for components, camelCase for functions
4. **Index exports** - Clean imports (`from '@/types'`)

---

This architecture balances **simplicity** for learning with **scalability** for real-world use.
