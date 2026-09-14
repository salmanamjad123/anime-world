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

## Sync model (client, v0.4+)

Room match writes are **revision-gated**:

- `match.matchRev` bumps on every accepted write.
- Mid-turn picks use `patchMySide` (queue/weave only) — cannot rewind `activeSide` / `echo` / HP.
- Turn advances use `commitTurnWrite` with expected `{ echo, activeSide, matchRev }` inside a Firestore transaction.
- Both clients render the timer from `match.turnDeadlineAt` (absolute deadline).

### Scale note (~100 concurrent players)

Firestore per-room docs + transactions are fine for tens of concurrent private matches.
For hundreds of concurrent PvP users, move turn resolve to a **Cloud Function** (client sends intent; server runs `commitTurn` and writes). That removes client trust and cut write races further. See `docs/GAME_ARENA.md` ops section when added.
