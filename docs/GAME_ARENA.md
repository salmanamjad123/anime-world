# Village Arena — Game Design & Build Guide

**Working title:** Village Arena  
**Route:** `/game`  
**Header label:** Game  
**Ruleset version:** `v0.3`  
**Status:** Lobby, bot battles, and private room-code PvP shipped. Ranked matchmaking is next.

This document is the source of truth for building a scalable, responsive, ranked 3v3 arena on Anime Village. UI layout is inspired by Naruto-Arena’s lobby and battle chrome. **Characters, names, jutsu, villages, and art are original.** Do not copy licensed IP.

---

## 1. Why this game exists

Anime Village already has watch + read. Arena is the third pillar: **players compete with each other**, not just consume catalog.

Goals:

- Fast matches (3–6 minutes), not 20-minute stalls
- Readable skills, juicy resolve animations
- Unique original fighters with ranks, points, streaks
- Works on phone and desktop
- Can grow from a sandbox to an industry-level ranked game without rewriting the data model

Non-goals for v1:

- Real money packs
- 200-card collection
- Unity/Unreal client
- Licensed Naruto / One Piece / Dragon Ball fighters

---

## 2. Legal fence (non-negotiable)

| Allowed | Forbidden |
|---|---|
| Original names, original art, original skill names | Naruto, Luffy, Goku, village names, jutsu names, portraits |
| Anime *archetypes* (ninja-like, sea raider, spirit warrior) | Scraped or traced official art |
| “Inspired by arena fighters” UX | Using Bandai / Shueisha / Toei marks |

If a name sounds like an existing character, rename it before shipping.

---

## 3. Reference layout (from Naruto-Arena screens)

We copy **information architecture**, not assets.

### 3.1 Lobby (`/game`)

```
┌─────────────────────────────────────────────────────────────┐
│  [Hero art of focused fighter]              [Fullscreen]    │
│  large, faction-colored, with ambient orbs                  │
├──────────────┬──────────────────┬───────────────────────────┤
│  Ranked      │  Quick Duel      │  Private Gate             │
├──────────────┴──────────────────┴──────────────┬────────────┤
│  Fighter portrait grid (scrollable)            │ Info card  │
│  3-across on mobile, 7–9 on desktop            │ name       │
│  selected = gold ring                          │ epithet    │
│  in-team = numbered seal 1/2/3                 │ faction    │
│  locked = grayscale + lock                     │ rarity     │
│                                                │ 3 arts     │
│  Team row: three slots under the grid          │ energy map │
│  “Ready” only when 3 unique fighters           │ resonance  │
└────────────────────────────────────────────────────────────┘
```

### 3.2 Battle (`/game/battle`)

```
┌──────── player HUD ────────┬── timer / ready ──┬──── foe HUD ────┐
│ name · rank · streak       │  PRESS WHEN READY │ name · rank     │
│ Weave pips (4 colors)      │  0:22             │ hidden pips     │
├──────── left column ───────┤                   ├─ right column ──┤
│ Fighter A  HP  [skills]    │   showcase art    │ [skills] HP  A  │
│ Fighter B  HP  [skills]    │   of last caster  │ [skills] HP  B  │
│ Fighter C  HP  [skills]    │   or arena idle   │ [skills] HP  C  │
├──────────────────────────────────────────────────────────────────┤
│ Surrender · selected fighter arts (4) · energy pay · log         │
└──────────────────────────────────────────────────────────────────┘
```

Mobile stacks: HUDs on top, board in the middle, skill bar sticky at the bottom.

---

## 4. Unique design (not a clone)

Naruto-Arena is sequential, 60s, chakra-named, and slow. Village Arena changes the feel:

| System | Our version | Why |
|---|---|---|
| Resource | **Weave** — Strike / Tide / Pulse / Blood / Any | Original, color-blind patterns on pips |
| Turns | **Echo Lock** — both players pick at once, then cinematic resolve | Marvel Snap pacing |
| Team bonus | **Resonance** — 2+ same faction, or 3-faction Chaos Pulse | Deckbuilding hook |
| Rank | Dual: hidden Glicko-2 MMR + visible Forge rank + streak ember | Hearthstone lesson |
| Defend | **Aegis Veil** — universal, 4-turn cooldown, 1 Any | Fair baseline |
| Catch-up | **Ash Rule** — Echo 1 host gets 1 weave, challenger gets 3; later Echoes 1 per living minus tidebinds | Stops first-turn snowball |
| Anti-stall | 22s Echo window, auto-Aegis if empty queue | No AFK forever |
| Bank | Weave cap **7** — extra pips discarded | Stops infinite stall banks |
| Control wave | Stun / drain / veil / bind resolve **before** damage | Stun cancels their strike |
| Bloodied | ≤35 HP: +20% damage dealt | Comeback closer |
| Combo | 2+ queued arts from the same faction: +6 damage | Reward focused teams |
| Focus-fire | Second hit on the same fighter this Echo: +8 | Finish seals |
| Veil counter | Hitting Aegis deals **10** back to the attacker | Don't dump into veil |
| Anti-brick | Team builder warns if the 3 fighters spend fewer than 3 weave colors | Classic arena lesson |
| Reconnect | Event log replay, not live tick guess | Competitive integrity |
| Skip | Resolve animations skippable after first view | Respect time |

**Resonance (v1):**

- 2 same faction: `+5` damage on that faction’s arts that round
- 3 same faction: `+8` and first art ignores 1 shield
- 3 different factions: Chaos Pulse — `+1 Any` weave each Echo

**Win:** all 3 enemy fighters at 0 HP, or higher total HP at Echo 12 cap.

---

## 5. Core rules (v0.1)

### 5.1 Match

- 1v1, each side fields **exactly 3 unique fighters**
- Each fighter starts at **100 HP**
- Echo 1..12, simultaneous
- Living fighters grant 1 random weave pip at Echo start (Ash Rule on Echo 1)
- A fighter at 0 HP is sealed: no arts, no weave grant, lingering effects expire next Echo

### 5.2 Arts

Every fighter has **3 unique arts + Aegis Veil**.

Each art has:

- Weave cost (map of colors, `any` is wild)
- Cooldown in Echoes
- Target: self / ally / enemy / all enemies / random enemy
- Data-driven effects (never `if (fighterId === 'kaen')`)

Illegal if: fighter sealed, art on cooldown, not enough weave, illegal target, Echo already locked.

### 5.3 Hidden information

Opponent queued arts show as `?` until resolve. Opponent unused weave is hidden. HP, cooldowns of *used* arts, and sealed state are public.

### 5.4 Modes

| Mode | Counts for rank | Auth | Notes |
|---|---|---|---|
| Ranked Forge | Yes | Required | MMR matchmaking |
| Quick Duel | No | Optional | Humans if found in 8s, else Shade bot |
| Private Gate | No | Required | 6-char room code, expires 10 min |
| Practice Shade | No | Optional | Always bot, from lobby or Quick timeout |

Guests may browse the roster and fight Shade. Ranked and Private open the existing auth modal.

---

## 6. Progression

### Visible Forge ranks

`Ashen → Ember → Flame → Crucible → Solar → Mythic → Legend`

Each rank has 5 stars. Win = +1 star (streak 3 = +2, streak 5 = +3). Loss = −1 star except floor of each rank.

### Hidden MMR

Glicko-2, starting `1500 / RD 350`. Matchmaking uses MMR only. Visible rank is for the player’s dopamine, not pairing.

### Streak Ember

3 / 5 / 8 wins in a row apply a lobby aura and bonus stars. Breaks on loss or 24h idle.

### Inventory (later)

Card definition `cards/{id}` vs owned copy `users/{uid}/inventory/{copyId}` so foils, levels, and skins do not fork the ruleset.

Starter: 9 unlocked fighters (3 per faction). Remaining 9 unlock by Forge level or wins.

---

## 7. Architecture (scalable from day one)

Do **not** run the live match on Next.js route handlers. Vercel is the shell. The match is a sticky room.

```
Browser (Next.js /game)
    │  lobby, collection, ranks, this sandbox
    │
    ├─ Firebase Auth          already on the site
    ├─ Firestore              catalog, inventory, match results, seasons
    ├─ Redis                  matchmaking sorted sets
    └─ Cloudflare Durable Object (one per matchId)
           WebSocket + alarm timer + authoritative applyIntent()
```

### 7.1 Layer split

| Layer | Tech | Owns |
|---|---|---|
| Shell | Next.js App Router | `/game`, `/game/battle`, header tab |
| Rules | Pure TypeScript `lib/game/engine` | `applyIntent`, `playerView`, replay |
| Room | Cloudflare Durable Object | sockets, turn alarm, persistence |
| Queue | Redis | MMR wait buckets |
| Battle view | React now → PixiJS later | animations only consume events |
| HUD | React + Framer Motion | timers, toasts, skill bar |

### 7.2 Engine contract (implement before netcode)

```ts
createMatch(seed, teams, rulesetVersion): MatchState
applyIntent(state, playerId, intent): { state, events } | { error }
playerView(state, playerId): PublicView
isTerminal(state): { winner } | null
```

All of this must run **headless** (Node tests, no DOM). The sandbox page is a thin UI over the same functions once the engine exists.

### 7.3 Event log

Every resolve is a list of events the client plays:

`EchoStart → ArtLocked → Damage → Status → Seal → EchoEnd`

Reconnect = replay events. Spectator = same log, both views.

### 7.4 Ruleset versioning

`rulesetVersion` is stored on the match. Patches bump it. In-flight matches keep the old catalog snapshot. Never hot-swap skill numbers mid-match.

---

## 8. Data model

```
cards/{fighterId}                      static catalog + rulesetVersion
users/{uid}/arena                      mmr, rank, stars, streak, wins, losses, seasonId
users/{uid}/inventory/{copyId}
users/{uid}/teams/{teamId}             3 fighter ids
matches/{matchId}                      seed, result, mmrDelta, replayUrl, rulesetVersion
seasons/{seasonId}
leaderboards/{seasonId}/entries/{uid}
```

Redis:

```
queue:ranked          ZSET score=mmr
queue:quick
presence:{uid}
gate:{code}           private room → matchId, TTL 10m
```

Current shell keeps team selection in Zustand (`useGameLobbyStore`) so the battle page can start without Firebase writes.

---

## 9. File map (this repo)

```
docs/GAME_ARENA.md                 this file
types/game.ts                      shared types
lib/game/roster.ts                 18 original fighters
lib/game/team-rules.ts             3-pick, uniqueness, weave coverage, resonance
lib/game/aegis.ts                  universal defend art
store/useGameLobbyStore.ts         lobby + battle handshake
components/game/GameLobby.tsx      reference lobby
components/game/BattleSandbox.tsx  reference battle
app/game/page.tsx                  /game
app/game/layout.tsx                metadata
app/game/battle/page.tsx           /game/battle
```

Next engine drop (not in this shell):

```
lib/game/engine/state.ts
lib/game/engine/intents.ts
lib/game/engine/resolve.ts
lib/game/engine/rng.ts
cf-worker/game/MatchRoom.ts        Durable Object
```

---

## 10. Roster v0.3 (24 original)

Factions: **Ashen Leaf** (ember strikers), **Black Tide** (sea control), **Sky Pulse** (spirit burst).

All 24 are unlocked in this drop so the lobby can be judged. Later: starters vs wins/rank gates.

New archetypes (original names only): Kenji Orb, Kage Bind, Riku Tide, Pela Kettle, Six Hollow, Cage Void.

Factions: **Ashen Leaf** (ember strikers), **Black Tide** (sea control), **Sky Pulse** (spirit burst).

| ID | Name | Faction | Role | Unlock |
|---|---|---|---|---|
| kaen-roux | Kaen Roux | Ashen | Striker | Starter |
| shiro-vale | Shiro Vale | Ashen | Control | Starter |
| rin-ashe | Rin Ashe | Ashen | Support | Starter |
| mori-kess | Mori Kess | Ashen | Control | Wins |
| toru-blade | Toru Blade | Ashen | Striker | Wins |
| yuna-veil | Yuna Veil | Ashen | Control | Rank |
| captain-vex | Captain Vex | Tide | Tank | Starter |
| kaito-reef | Kaito Reef | Tide | AoE | Starter |
| isla-dusk | Isla Dusk | Tide | Tank | Starter |
| namiross | Namiross | Tide | Drain | Wins |
| brine | Brine | Tide | Drain | Wins |
| sable-hook | Sable Hook | Tide | Drain | Rank |
| aora-zen | Aora Zen | Pulse | Striker | Starter |
| lys-rael | Lys Rael | Pulse | Striker | Starter |
| hali-storm | Hali Storm | Pulse | AoE | Starter |
| kiro-pulse | Kiro Pulse | Pulse | Control | Wins |
| senna-drift | Senna Drift | Pulse | Support | Wins |
| venn-hollow | Venn Hollow | Pulse | Support | Rank |

Each unique art is authored as data in `lib/game/roster.ts`. Balance numbers will move; IDs will not.

---

## 11. Edge cases (build these in, do not patch later)

### Lobby

- Fewer than 3 picks: Ranked / Quick / Private stay disabled, copy explains why
- Same fighter twice: ignored
- Clicking a picked fighter on the grid removes them
- Locked fighter: info visible, cannot add
- Guest + Ranked / Private: open existing auth modal, keep the team
- Guest + Quick: Practice Shade (bot)
- Weave coverage < 3 colors: amber warning, still allowed
- 3-faction Chaos Pulse: teal notice
- Fullscreen: requestFullscreen on the lobby root, fallback no-op
- Persist last team in localStorage (versioned key `va-team-v1`)
- Resize: grid 3 / 6 / 9 columns; hero art shrinks; info panel docks under grid on mobile

### Matchmaking (when wired)

- Expand MMR window: 5s ±50, 15s ±120, 30s ±250, then Shade fill for Quick only
- Ranked never fills with a bot
- Cancel returns to lobby, queue key deleted
- Double-click start: single-flight lock
- Already in a match: resume `/game/battle?match=` instead of a second queue

### Battle

- No team in store: redirect `/game`
- Refresh: restore from session snapshot (engine later; sandbox rebuilds from store)
- Timer 0 with empty queue: auto Aegis on living fighters if weave allows, else skip
- Disconnect < 45s: pause both clients, then resume
- Disconnect ≥ 45s: remaining player wins by forfeit
- Both disconnect: match void, no MMR
- Illegal intent: reject, do not desync
- Simultaneous identical targeting: resolve by seed, not by who clicked first
- KO mid-resolve: remaining queued arts from that fighter fizzle with `Sealed` event
- Animation skip: state already final, visuals catch up
- `prefers-reduced-motion`: skip particles, keep HP tweens
- Safe area insets on notched phones for the sticky skill bar

### Economy / ranked (later)

- Never trust client damage or “I won”
- Season reset: visible stars reset, MMR soft-normalized, no tanking bonus
- Duplicate queue devices: newest socket wins, old one kicked with reason

---

## 12. Presentation plan

**Now (shell):** CSS + SVG portraits + Framer Motion. Enough to judge layout, color, and flow.

**Next (juice):** PixiJS canvas behind the HUD for projectiles, hit-stop, screenshake. React keeps bars and buttons.

**Then (characters):** Rive or Spine idle / cast / hit / seal. Six signature VFX reused across the roster (slash, fire, tide, bolt, barrier, drain) beat 80 unique mediocre effects.

Performance budget: 60fps on mid-range phones, preload 6 portrait rigs before Fight, atlas later, particle cap on mobile.

---

## 13. Ranked formula (when MMR ships)

Use **Glicko-2** for 1v1. Do not use Elo (slow to stabilize) and do not use Battlegrounds-style 8-player math.

Matchmaking: closest MMR with expanding window. Visible Forge rank is a skin over stars. Streak Ember only changes star grant, not pairing.

---

## 14. Build phases

| Phase | Outcome | Done when |
|---|---|---|
| 0 | GDD + lobby + battle chrome + header Game tab | This drop |
| 1 | Headless engine + unit tests + Shade uses engine | Bot fight is real rules |
| 2 | Durable Object room + Redis Quick queue | Two browsers can duel |
| 3 | Ranked + Private + profile stats | Streaks persist |
| 4 | Pixi resolve + audio | Feels like a game, not a form |
| 5 | Seasons, spectate, daily quests | Live-ops |

Do not start Phase 4 before Phase 1. Pretty wrong math trains bad muscle memory.

---

## 15. Design tokens

```
ember:     #f97316  #ea580c  #9a3412
parchment: #f3e6c9  #c4a574  #8a6a3b
ink:       #140e0a
ashen:     #fb923c
tide:      #22d3ee
pulse:     #a78bfa
blood:     #e11d48
any:       #111827
strike:    #ef4444
ready:     #dc2626
forest:    #14301f
```

Color-blind weave pips also use shapes: Strike = diamond, Tide = wave, Pulse = circle, Blood = drop, Any = square.

---

## 16. Accessibility

- All grid cells are buttons with names
- Ready / mode buttons have disabled reasons in `aria-describedby`
- Battle timer is an `aria-live` polite region
- Keyboard: arrows in grid, Enter to toggle pick, 1–4 for arts in battle
- Contrast on parchment text ≥ 4.5:1
- Reduced motion respected

---

## 17. How to run the shell

1. Open `/game` (header **Game** tab)
2. Pick 3 unlocked fighters
3. **Quick Duel** as guest → Shade battle
4. **Private Gate** → login, Create gate (share code) or Join gate. Two players, same rules.
5. Battle: select a fighter, queue an art, Press When Ready. Control resolves before damage.

Header stays on the lobby. Battle is full-bleed (same idea as `/watch`). Footer is hidden on `/game/*`.

---

## 18. Decision log

- **Route `/game`** because the header label is Game
- **Original roster** so the product can be public and ranked
- **Simultaneous Echo** instead of sequential 60s turns
- **Sandbox first** so UX and tokens can be judged before netcode
- **Zustand handshake** between lobby and battle until Firestore teams exist
- **No barrel files** for game components (import the file you need)
