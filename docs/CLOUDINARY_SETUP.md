# Cloudinary Setup

Profile avatars and user media are stored in Cloudinary with a clean project structure.

## Folder Structure

```
anime-world/
├── avatars/{userId}/     # Profile photos (used in comments, replies, header)
├── comments/{userId}/     # Future: comment attachments
└── user-content/{userId}/{subfolder}/  # Future: other UGC
```

## Environment Variables

Add to `.env.local`:

```env
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Get these from [Cloudinary Console](https://console.cloudinary.com/).

## Usage

- **Profile upload**: User clicks avatar edit → selects image → uploads to `/api/profile/upload-photo` → Firestore `users/{uid}.photoURL` updated. Old Cloudinary avatar is deleted when present.
- **Display everywhere**: `UserAvatar` component used in profile, comments, replies, header
- **Comments**: Use live profile photo from Firestore (no snapshot). Comments fetch current `photoURL` by `userId` so avatars always match the user’s current profile.

## Components

- `components/ui/UserAvatar.tsx` – Reusable avatar (photo or initial fallback)
- `lib/cloudinary/` – Config, folders, upload helpers
