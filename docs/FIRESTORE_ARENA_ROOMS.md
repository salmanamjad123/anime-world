# Firestore rules for Village Arena rooms

Private Gate uses `arenaRooms/{code}`. Add this to Firebase Console → Firestore → Rules (merge with comments / watchlist).

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /arenaRooms/{code} {
      allow read: if request.auth != null;
      allow create: if request.auth != null
        && request.resource.data.hostUid == request.auth.uid
        && request.resource.data.code == code;
      allow update: if request.auth != null && (
        resource.data.hostUid == request.auth.uid ||
        resource.data.guestUid == request.auth.uid ||
        (resource.data.guestUid == null && request.resource.data.guestUid == request.auth.uid)
      );
      allow delete: if request.auth != null && resource.data.hostUid == request.auth.uid;
    }
  }
}
```

Until these rules are published, Create / Join still works on **this device** via localStorage + BroadcastChannel (two browser tabs). Two phones need the cloud rules above.
