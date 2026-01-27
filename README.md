# 🎌 Anime World

A modern, feature-rich anime streaming platform built with Next.js 15, TypeScript, and Firebase.

## 📋 Features

- 🎬 **Browse & Search** - Explore thousands of anime with advanced search and filters
- 🎭 **Sub & Dub Support** - Watch anime in Japanese (sub) or English (dub)
- 📱 **Responsive Design** - Optimized for mobile, tablet, and desktop
- 💾 **Continue Watching** - Pick up where you left off
- ⭐ **Watchlist** - Save your favorite anime
- 🌙 **Dark/Light Theme** - Toggle between themes
- ⚡ **Fast Performance** - Server-side rendering with React Query caching
- 🔄 **Multiple Servers** - Automatic fallback if one server fails

## 🏗️ Tech Stack

### Core
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type-safe code
- **Tailwind CSS** - Utility-first styling

### State Management & Data Fetching
- **Zustand** - Lightweight state management with localStorage persistence
- **TanStack Query (React Query)** - Server state management with caching
- **Firebase** - User authentication and watchlist storage

### Video & UI
- **HLS.js** - HLS video playback
- **React Player** - Video player component
- **Framer Motion** - Smooth animations
- **Lucide React** - Beautiful icons

### APIs
- **AniList GraphQL** - Anime metadata (title, description, images, etc.)
- **Consumet API** - Streaming sources with sub/dub support

## 📁 Project Structure

```
anime-world/
├── app/                          # Next.js App Router
│   ├── (routes)/                # Route groups
│   │   ├── page.tsx            # Home page
│   │   ├── anime/              # Anime pages
│   │   │   └── [id]/           
│   │   │       └── page.tsx    # Anime detail page
│   │   ├── watch/              # Watch pages
│   │   │   └── [animeId]/
│   │   │       └── [episodeId]/
│   │   │           └── page.tsx # Video player page
│   │   ├── search/             
│   │   │   └── page.tsx        # Search results
│   │   └── watchlist/          
│   │       └── page.tsx        # User's watchlist
│   ├── api/                    # API routes
│   │   ├── anime/              # Anime endpoints
│   │   ├── search/             # Search endpoint
│   │   ├── episodes/           # Episodes endpoint
│   │   └── stream/             # Streaming sources endpoint
│   ├── layout.tsx              # Root layout with providers
│   └── globals.css             # Global styles
│
├── components/                  # React components
│   ├── ui/                     # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── ...
│   ├── layout/                 # Layout components
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── Sidebar.tsx
│   ├── anime/                  # Anime-specific components
│   │   ├── AnimeCard.tsx
│   │   ├── AnimeGrid.tsx
│   │   ├── AnimeCarousel.tsx
│   │   └── AnimeDetails.tsx
│   ├── player/                 # Video player components
│   │   ├── VideoPlayer.tsx
│   │   ├── PlayerControls.tsx
│   │   └── EpisodeList.tsx
│   └── providers/              # Context providers
│       ├── QueryProvider.tsx
│       └── ThemeProvider.tsx
│
├── lib/                        # Core libraries
│   ├── api/                    # API clients
│   │   ├── anilist.ts         # AniList API client
│   │   ├── consumet.ts        # Consumet API client
│   │   └── axios.ts           # Axios instance
│   ├── firebase/               # Firebase setup
│   │   ├── config.ts          # Firebase config
│   │   ├── auth.ts            # Auth helpers
│   │   └── firestore.ts       # Firestore helpers
│   └── utils.ts               # Utility functions
│
├── hooks/                      # Custom React hooks
│   ├── useAnime.ts            # Anime data hooks
│   ├── useSearch.ts           # Search hook
│   ├── useEpisodes.ts         # Episodes hook
│   ├── useStream.ts           # Stream sources hook
│   └── useMediaQuery.ts       # Responsive hooks
│
├── store/                      # Zustand stores
│   ├── useWatchlistStore.ts   # Watchlist state
│   ├── useHistoryStore.ts     # Watch history state
│   ├── useThemeStore.ts       # Theme state
│   └── usePlayerStore.ts      # Video player state
│
├── types/                      # TypeScript types
│   ├── anime.ts               # Anime types
│   ├── episode.ts             # Episode types
│   ├── stream.ts              # Stream types
│   └── user.ts                # User types
│
├── constants/                  # Constants & config
│   ├── api.ts                 # API URLs
│   ├── routes.ts              # Route paths
│   └── genres.ts              # Genre list
│
└── .env.local                 # Environment variables
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and pnpm (or npm/yarn)
- Firebase account (for user features)

### Installation

1. **Clone or navigate to the project**
```bash
cd "d:\mywork\Anime world\anime-world"
```

2. **Install dependencies**
```bash
pnpm install
# or
npm install
```

3. **Set up environment variables**

Create a `.env.local` file in the root:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# API URLs (optional - defaults provided)
NEXT_PUBLIC_ANILIST_API_URL=https://graphql.anilist.co
NEXT_PUBLIC_CONSUMET_API_URL=https://api.consumet.org
```

4. **Run the development server**
```bash
pnpm dev
# or
npm run dev
```

5. **Open your browser**
```
http://localhost:3000
```

## 🔧 Configuration

### Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** (Email/Password, Google, etc.)
3. Create a **Firestore Database**
4. Copy your config from Project Settings > General > Your apps > Config
5. Add the values to `.env.local`

### Firestore Collections Structure

```typescript
// users/{userId}
{
  email: string;
  displayName: string;
  createdAt: timestamp;
}

// watchlist/{userId}/anime/{animeId}
{
  animeId: string;
  title: string;
  image: string;
  addedAt: timestamp;
}

// history/{userId}/watching/{animeId}
{
  animeId: string;
  episodeId: string;
  episodeNumber: number;
  timestamp: number;
  lastWatched: timestamp;
}
```

## 📚 Key Architecture Decisions

### Why This Structure?

1. **Separation of Concerns**
   - `lib/` - External API logic
   - `store/` - Client state
   - `hooks/` - Data fetching & business logic
   - `components/` - UI presentation

2. **Type Safety**
   - All types centralized in `types/`
   - Shared across API, store, and components

3. **Performance**
   - TanStack Query caching reduces API calls
   - Zustand with localStorage for instant state restoration
   - Next.js Server Components for initial data

4. **Maintainability**
   - Clear folder structure
   - Each file has a single responsibility
   - Easy to locate and modify code

## 🎯 Development Workflow

### Adding a New Feature

1. **Define types** in `types/`
2. **Create API client** in `lib/api/`
3. **Create hook** in `hooks/`
4. **Create store** in `store/` (if needed)
5. **Create components** in `components/`
6. **Create page** in `app/`

### Example: Adding "Favorites" Feature

```typescript
// 1. types/favorite.ts
export interface Favorite {
  animeId: string;
  title: string;
  addedAt: Date;
}

// 2. store/useFavoritesStore.ts
export const useFavoritesStore = create(
  persist(
    (set) => ({
      favorites: [],
      addFavorite: (anime) => set((state) => ({...})),
    }),
    { name: 'favorites' }
  )
);

// 3. hooks/useFavorites.ts
export const useFavorites = () => {
  const { favorites, addFavorite } = useFavoritesStore();
  // Add Firebase sync logic
};

// 4. components/anime/FavoriteButton.tsx
// 5. Use in anime detail page
```

## 🧪 Best Practices

### Component Structure
```typescript
// Always follow this order:
1. Imports
2. Types/Interfaces
3. Component
4. Styled components (if any)
5. Export
```

### Naming Conventions
- **Components**: PascalCase (`AnimeCard.tsx`)
- **Hooks**: camelCase with `use` prefix (`useAnime.ts`)
- **Stores**: camelCase with `use` prefix and `Store` suffix (`useWatchlistStore.ts`)
- **Types**: PascalCase (`Anime`, `Episode`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)

### Git Workflow
```bash
# Feature branches
git checkout -b feature/anime-filters

# Commit messages
git commit -m "feat: add genre filters to search"
git commit -m "fix: resolve video player autoplay issue"
```

## 🐛 Troubleshooting

### Video Not Playing
- Check if HLS stream URL is valid
- Try switching servers
- Ensure browser supports HLS (use hls.js fallback)

### API Rate Limiting
- AniList: 90 requests per minute
- Consumet: Depends on hosting
- Use React Query caching to minimize requests

### CORS Issues
- All API calls go through `/app/api/` routes
- Never call external APIs directly from frontend

## 📝 TODO / Future Enhancements

- [ ] Add user profiles
- [ ] Implement comment system
- [ ] Add download functionality
- [ ] Multi-language UI (English, Urdu, etc.)
- [ ] PWA support for offline viewing
- [ ] Advanced filters (year, season, studio)
- [ ] Recommendation engine
- [ ] Watch party feature

## 📄 License

This project is for educational purposes (FYP). Please respect copyright and streaming laws.

## 🤝 Contributing

Since this is an FYP, contributions are welcome from team members. Follow the project structure and submit PRs.

## 🙏 Credits

- **APIs**: AniList, Consumet
- **Framework**: Next.js by Vercel
- **Icons**: Lucide React
- **Fonts**: Geist Sans & Geist Mono

---

Built with ❤️ for anime fans
