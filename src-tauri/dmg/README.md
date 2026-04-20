# DMG Installer Assets

This directory holds design assets for the macOS DMG installer that opens when a user
double-clicks the downloaded `.dmg`. The target is the little Finder window that shows
the app icon on the left and the Applications-folder shortcut on the right, inviting
the user to drag the app across.

## Current status

There is **no `background.png` yet**. Until a designed background is dropped in here
AND the `"background": "dmg/background.png"` line is re-enabled in
`../tauri.conf.json` (inside `bundle.macOS.dmg`), Tauri falls back to its default
placeholder background.

The window/icon positions below are already wired up in `tauri.conf.json`, so as soon
as you add a `background.png` that matches those coordinates, the layout will line up.

## Required asset: `background.png`

- **Filename:** `background.png` (placed directly in this `src-tauri/dmg/` directory)
- **Dimensions:** 660 × 400 px (or 1320 × 800 px for @2x retina — Tauri will pick it up)
- **Format:** PNG, RGB or RGBA, no transparency required
- **Style** (per `/Brand-guideline.md`):
  - White or warm-grey background
  - Momentum Talk logo/wordmark on the left half
  - Subtle arrow pointing from the app icon position to the Applications folder position
  - Arc / Linear aesthetic — flat, no drop shadows, no gradients
  - Plenty of whitespace, brand typography

## Coordinate reference (MUST match what the config declares)

These are the exact positions `tauri.conf.json` configures. The designer needs to
place visual anchors (icon circles, arrow, labels) at these spots so that when Tauri
stamps the real icons on top, they land in the right place:

| Element                   | x   | y   |
| ------------------------- | --- | --- |
| Window size               | 660 | 400 |
| Window spawn position     | 200 | 200 |
| App icon                  | 180 | 180 |
| Applications folder alias | 480 | 180 |

So: app icon on the left-center, Applications shortcut on the right-center, same
y-coordinate. Leave roughly 128 px circular clearance around each icon position and
draw the arrow between them.

## Re-enabling after you add the file

Once `background.png` is in this folder, open `src-tauri/tauri.conf.json` and add
this line inside `bundle.macOS.dmg` (alongside `windowSize`, `appPosition`, etc.):

```json
"background": "dmg/background.png",
```

Then rebuild with `bun run tauri build` and open the generated `.dmg` from
`src-tauri/target/release/bundle/dmg/` to verify.

## Volume icon

The DMG's volume icon (the drive icon shown on the desktop when the DMG is mounted)
is inherited from `../icons/icon.icns` automatically. No separate file is needed
here. If `icon.icns` is regenerated from a fresh 1024 × 1024 PNG via `iconutil` or
`bun run tauri icon`, the volume icon updates too.
