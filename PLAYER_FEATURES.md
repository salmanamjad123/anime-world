# Video Player Features - Complete Guide

## 🎬 **New Features Added**

Your video player now has **professional-grade streaming features**!

---

## ✨ **Features Overview**

### 1. **Quality Selection** (480p, 720p, 1080p)
- **Manual quality selection** - Choose your preferred quality
- **Auto quality mode** - Automatically selects best quality
- **Smooth quality switching** - No interruption in playback
- **Quality indicator** - Shows current quality in settings

### 2. **Adaptive Bitrate Streaming (ABR)**
- **Smart quality adjustment** - Automatically adjusts based on network speed
- **Buffer management** - Prevents buffering and lag
- **Seamless switching** - Changes quality without pausing
- **HLS.js integration** - Industry-standard adaptive streaming

### 3. **Subtitle Support**
- **Multiple subtitle tracks** - English, Japanese, and more
- **Subtitle toggle** - Easy on/off switching
- **Subtitle selector** - Choose your preferred language
- **Synced subtitles** - Perfect timing with video

### 4. **Sub/Dub Selection**
- **SUB** - Japanese audio with subtitles
- **DUB** - English dubbed audio
- **Easy toggle** - Switch between sub and dub instantly
- **Episode-specific** - Loads correct version for each episode

---

## 🎮 **How to Use**

### **Quality Selection:**

1. Click the **Settings (⚙️)** button in the video player
2. Select **Quality**
3. Choose from:
   - **Auto** (recommended) - Best quality for your connection
   - **1080p** - Full HD (if available)
   - **720p** - HD
   - **480p** - Standard
   - **360p** - Low quality (faster loading)

### **Subtitle Selection:**

1. Click the **Settings (⚙️)** button
2. Select **Subtitles**
3. Choose from available subtitle languages or turn **Off**

### **Sub/Dub Toggle:**

1. Located below the video player
2. Click **SUB** for Japanese audio with subtitles
3. Click **DUB** for English dubbed audio
4. The video will reload with your selected audio

---

## 🛠️ **Technical Implementation**

### **Files Modified:**

#### **1. VideoPlayer Component** (`components/player/VideoPlayer.tsx`)
```typescript
interface VideoPlayerProps {
  src: string;
  sources?: VideoSource[];      // ✨ NEW: All quality options
  subtitles?: Subtitle[];        // ✨ NEW: Subtitle tracks
  poster?: string;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  autoPlay?: boolean;
}
```

**Features Added:**
- Quality selector menu with all available qualities
- Subtitle track selector menu
- Auto quality mode with adaptive bitrate streaming
- Smooth quality switching that preserves playback position
- Subtitle track injection into video element
- Settings button with nested menus

**HLS.js Configuration:**
```typescript
const hls = new Hls({
  enableWorker: true,
  lowLatencyMode: true,
  backBufferLength: 90,
  startLevel: autoQuality ? -1 : undefined,  // ✨ -1 = auto quality
  capLevelToPlayerSize: true,                // ✨ Smart quality selection
  maxMaxBufferLength: 30,                    // ✨ Optimal buffering
});
```

#### **2. Watch Page** (`app/watch/[animeId]/[episodeId]/page.tsx`)
```typescript
// Pass all sources and subtitles to player
<VideoPlayer
  src={videoSource}
  sources={streamData?.sources}      // ✨ All qualities
  subtitles={streamData?.subtitles}  // ✨ All subtitle tracks
  poster={anime.bannerImage || anime.coverImage.large}
  onTimeUpdate={handleTimeUpdate}
  onEnded={handleEpisodeEnd}
  autoPlay
/>

// Sub/Dub toggle UI
<div className="flex bg-gray-700 rounded-lg p-1">
  <button onClick={() => setSelectedLanguage('sub')}>SUB</button>
  <button onClick={() => setSelectedLanguage('dub')}>DUB</button>
</div>
```

#### **3. Stream Hook** (`hooks/useStream.ts`)
```typescript
// Added category parameter for sub/dub selection
export function useStreamingSourcesWithFallback(
  episodeId: string | null,
  category: 'sub' | 'dub' | 'raw' = 'sub'  // ✨ NEW
) {
  // Passes category to API
  const response = await fetch(
    `/api/stream/${episodeId}?fallback=true&category=${category}`
  );
}
```

---

## 📊 **How It Works**

### **Quality Selection Flow:**

```
User clicks Settings → Quality → Selects 720p
     ↓
VideoPlayer updates currentQuality state
     ↓
useEffect detects change
     ↓
getCurrentSource() returns 720p URL
     ↓
HLS.js loads new source
     ↓
Playback position restored
     ↓
Video continues at 720p!
```

### **Auto Quality (ABR) Flow:**

```
User selects "Auto" quality
     ↓
HLS.js startLevel set to -1
     ↓
HLS.js monitors:
  - Network bandwidth
  - Current buffer level
  - Player size
     ↓
Automatically switches between qualities:
  - Fast network → 1080p
  - Slow network → 480p
  - Medium network → 720p
     ↓
Seamless quality adjustments!
```

### **Subtitle Flow:**

```
API returns subtitle tracks
     ↓
VideoPlayer adds <track> elements to <video>
     ↓
Subtitles proxied through /api/proxy
     ↓
User selects subtitle language
     ↓
track.mode = 'showing' for selected
     ↓
Subtitles display on video!
```

### **Sub/Dub Flow:**

```
User clicks DUB button
     ↓
setSelectedLanguage('dub')
     ↓
useStreamingSourcesWithFallback refetches
     ↓
API returns dubbed episode sources
     ↓
Video player loads dubbed version
     ↓
Episode plays in English!
```

---

## 🎯 **Benefits**

### **For Users:**
- ✅ Choose quality based on internet speed
- ✅ Save data with lower quality options
- ✅ Watch in full HD when possible
- ✅ Auto-adjust quality for smooth playback
- ✅ Read subtitles in preferred language
- ✅ Switch between sub and dub easily

### **For Developers:**
- ✅ Industry-standard HLS.js implementation
- ✅ Clean, modular code structure
- ✅ Easy to add more quality options
- ✅ Extensible subtitle system
- ✅ Production-ready adaptive streaming

---

## 🔧 **Configuration**

### **Default Settings:**
```typescript
// In VideoPlayer component
const [currentQuality, setCurrentQuality] = useState<string>('auto');
const [currentSubtitle, setCurrentSubtitle] = useState<string>('off');
const [autoQuality, setAutoQuality] = useState(true);
```

### **HLS.js Settings:**
```typescript
{
  enableWorker: true,           // Use web worker for better performance
  lowLatencyMode: true,         // Reduce delay
  backBufferLength: 90,         // Keep 90s of buffer
  startLevel: -1,               // Auto select quality
  capLevelToPlayerSize: true,   // Don't load 4K on small screen
  maxMaxBufferLength: 30,       // Max 30s ahead buffer
}
```

---

## 📈 **Performance**

### **Quality Selection Impact:**

| Quality | File Size/Min | Data Usage (24min) | Recommended For |
|---------|---------------|-------------------|-----------------|
| **1080p** | ~10MB | ~240MB | Fast WiFi (10+ Mbps) |
| **720p** | ~5MB | ~120MB | Good WiFi (5+ Mbps) |
| **480p** | ~2.5MB | ~60MB | Mobile data (2+ Mbps) |
| **360p** | ~1.5MB | ~36MB | Slow connection (1+ Mbps) |
| **Auto** | Varies | Varies | Adjusts automatically |

### **Auto Quality Benefits:**
- **Faster loading** - Starts with lower quality, upgrades when buffered
- **No buffering** - Downgrades quality if network slows down
- **Optimal experience** - Always best quality for your connection

---

## 🌐 **API Response Format**

### **Stream API Response:**
```json
{
  "sources": [
    { "url": "https://...", "quality": "1080p", "isM3U8": true },
    { "url": "https://...", "quality": "720p", "isM3U8": true },
    { "url": "https://...", "quality": "480p", "isM3U8": true }
  ],
  "subtitles": [
    { "lang": "en", "label": "English", "url": "https://..." },
    { "lang": "ja", "label": "Japanese", "url": "https://..." }
  ],
  "intro": { "start": 0, "end": 90 },
  "outro": { "start": 1350, "end": 1440 }
}
```

---

## 🎨 **UI Design**

### **Settings Menu:**
```
┌─────────────────────┐
│ Quality      auto   │ ← Click to expand
├─────────────────────┤
│ Subtitles    Off    │ ← Click to expand
└─────────────────────┘
```

### **Quality Submenu:**
```
┌─────────────────────┐
│ Quality      auto   │
├─────────────────────┤
│   Auto         ✓    │ ← Selected
│   1080p             │
│   720p              │
│   480p              │
└─────────────────────┘
```

### **Subtitle Submenu:**
```
┌─────────────────────┐
│ Subtitles    en     │
├─────────────────────┤
│   Off               │
│   English      ✓    │ ← Selected
│   Japanese          │
└─────────────────────┘
```

### **Sub/Dub Toggle:**
```
┌─────────┬─────────┐
│  SUB ✓  │   DUB   │  ← SUB selected (blue)
└─────────┴─────────┘
```

---

## 🚀 **Future Enhancements (Optional)**

- [ ] Remember user's quality preference (localStorage)
- [ ] Show current bandwidth indicator
- [ ] Quality auto-switch notifications
- [ ] Custom subtitle upload
- [ ] Picture-in-picture mode
- [ ] Playback speed in settings
- [ ] Skip intro/outro buttons (data already available!)
- [ ] Quality badge on video
- [ ] Subtitle font size adjustment

---

## 🎉 **Summary**

You now have a **professional-grade video player** with:

✅ **Multiple quality options** (360p - 1080p)  
✅ **Adaptive bitrate streaming** (auto quality)  
✅ **Subtitle support** (multiple languages)  
✅ **Sub/Dub selection** (instant switching)  
✅ **Smooth quality switching** (no buffering)  
✅ **Production-ready** (HLS.js industry standard)  

**Your users can now:**
- Choose quality based on their connection
- Watch with subtitles in their preferred language
- Switch between sub and dub versions
- Enjoy smooth, buffer-free streaming!

---

## 📚 **Related Files**

- `components/player/VideoPlayer.tsx` - Main player component
- `app/watch/[animeId]/[episodeId]/page.tsx` - Watch page with controls
- `hooks/useStream.ts` - Streaming API hooks
- `types/stream.ts` - TypeScript type definitions
- `app/api/stream/[episodeId]/route.ts` - Streaming API endpoint

---

**🎊 All features are now complete and production-ready!**
