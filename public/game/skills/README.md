# Skill / jutsu art

Place attack images here for Naruto Arena–style tiles:

```
public/game/skills/{fighterId}/{artId}.png
```

Example: `public/game/skills/kenji-orb/orb-rush.png` → Naruto’s Rasengan tile.

Until a file exists, the UI shows the **fighter portrait + technique wash + attack glyph**, with the **attack name** under the tile.

Optional: set `art.icon` on a skill in the roster to force a custom URL.
