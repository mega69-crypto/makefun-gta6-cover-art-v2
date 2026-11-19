[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/mega69-crypto/makefun-gta6-cover-art-v2/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/mega69-crypto/makefun-gta6-cover-art-v2/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Neon Coast Cover Studio

Turn your photo into GTA-style cover art, fully offline. Pick a layout, pick a
sunset or neon colour grade, type a caption, and export a PNG.

## What it does

- 5 layouts: Four Panel, Hero + Three, Full Bleed, Nine Panel, Tilted Snapshots
- 5 gradient-map colour grades: Vice Sunset, Neon Night, Palm Dusk, Teal Heat, Mono Noir
- Bold Anton title lettering with a halftone title block, Pacifico neon subtitle
- Per-panel photos: click a panel to select it, drag to position the photo,
  zoom slider, and choose which photo fills each panel
- Film grain, vignette, Neon Coast badge ribbon, heat-meter stars
- 3 one-click presets, undo / redo
- Export PNG at 1080x1080, 1080x1350, 1920x1080 or 1080x1920, or all sizes at once

## How to use

1. Serve the `app/` folder with any static server, for example:
   `python3 -m http.server --directory app` then open http://localhost:8000
   (opening `app/index.html` directly from disk also works).
2. Two sample photos are preloaded so a cover is visible right away.
   Click **+ Add your photos** to use your own. Photos never leave your machine.
3. Pick a layout and grade, type your title and subtitle, drag panels to
   position each photo, then hit **Export cover PNG**.

## Fonts

Anton and Pacifico are bundled under `app/fonts/` under the SIL Open Font
License 1.1 (see `app/fonts/OFL-Anton.txt` and `app/fonts/OFL-Pacifico.txt`).

## License

MIT. See `LICENSE`. This project is not affiliated with Rockstar Games and
contains no Rockstar artwork, logos or fonts.
