# Firestore Security Rules for Comments

Add these rules to your Firestore security rules in the Firebase Console (Firestore Database → Rules). Merge with your existing rules for `watchlist` and `history` if you have them.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Comments: collection structure is comments/{animeId}/episodes/{episodeId}/comments/{commentId}
    match /comments/{animeId}/episodes/{episodeId}/comments/{commentId} {
      // Anyone can read comments
      allow read: if true;
      // Only authenticated users can create
      allow create: if request.auth != null
        && request.resource.data.userId == request.auth.uid;
      // Only the comment author can update or delete
      allow update, delete: if request.auth != null
        && resource.data.userId == request.auth.uid;
    }

    // Your existing rules for watchlist, history, etc. go below
    // match /watchlist/{userId}/anime/{animeId} { ... }
    // match /history/{userId}/watching/{animeId} { ... }
  }
}
```

## Firestore Indexes (if needed)

If you get an error about a missing index when querying comments, Firebase will provide a link to create it. You may need:

1. **Top-level comments**: `comments/{animeId}/episodes/{episodeId}/comments` — order by `createdAt` (asc or desc).

2. **Replies** (composite index): `comments/{animeId}/episodes/{episodeId}/comments`
   - Field: `parentId` (Ascending)
   - Field: `createdAt` (Ascending)

Create indexes when prompted by Firebase, or add them manually in Firebase Console → Firestore → Indexes.
