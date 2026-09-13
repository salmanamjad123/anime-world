# Personal anime audio (local / browser only)

Official anime OSTs and SFX are copyrighted — they are **not** included in this repo.

## Option A — Upload in the app (easiest)
1. Open Arena → **Audio**
2. Choose a track in the **Background / Attack / Damage** dropdown
3. Click **Upload MP3** and pick your file
4. Files are stored in this browser (IndexedDB), not committed to git

## Option B — Drop files into these folders
Use the exact filenames from the dropdown `fileHint` paths, e.g.:

```
public/game/music/bgm/naruto-main.mp3
public/game/music/bgm/op-overtaken.mp3
public/game/music/attack/rasengan.mp3
public/game/music/damage/heavy-hit.mp3
```

Then select that option in the Audio dropdowns.
