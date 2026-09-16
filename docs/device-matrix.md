# Device matrix

## Tiers

| Tier | Devices                                                                          | Promise                                                   |
| ---- | -------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Surface in landscape; iPad in landscape, as a Safari tab or from the Home Screen | Fully tuned, 60 fps, covered in CI                        |
| 2    | iPad in portrait; desktop browsers with a mouse or trackpad                      | Playable through zoom and pan, covered in CI              |
| 3    | Phones                                                                           | Work through the same zoom and pan; not tuned, not tested |

## What the platforms actually do

- **iPadOS ignores the manifest's `orientation: landscape`.** The layout survives portrait: the HUD stacks under the map, and `Camera.fit()` fits to a 40 px tile and pans instead of shrinking the board past a fingertip.
- **iOS has no `navigator.vibrate`.** Haptics are Android and Surface only, always optional-chained.
- **Safari reports the GPU as "Apple GPU"** through `WEBGL_debug_renderer_info`, which passes the software-rasteriser check, so an iPad takes the WebGL path.
- **iOS caps total canvas memory per page.** The sprite cache and the Pixi texture map are bounded LRUs (128 entries, 256 px cap).
- **Textures stay at or under 2048×2048** so every iPad in the family accepts them without a fallback path.
- **Safari's toolbars resize the visual viewport without a window resize.** `App.requestResize` listens to `visualViewport` and coalesces every signal into one refit per frame.
- **The HUD reflow resizes the canvas with no event at all.** `Renderer` watches its canvas with a `ResizeObserver` and calls the scene's `onViewportChange`; combat keeps a pinch zoom across that refit.
- **Home Screen apps on iOS 26 open every site as a web app**; the `apple-mobile-web-app-*` metas still set the title, the status bar and full-screen launch.

## Automated coverage

| Project          | Engine   | Profile                                | Specs                | Where                                  |
| ---------------- | -------- | -------------------------------------- | -------------------- | -------------------------------------- |
| `surface-touch`  | Chromium | 1368×912, touch, DPR 1                 | all                  | dev container and CI                   |
| `ipad-landscape` | WebKit   | iPad Pro 11 landscape, 1194×834, DPR 2 | all except `offline` | CI, or locally with `FNT_E2E_WEBKIT=1` |
| `ipad-portrait`  | WebKit   | iPad Pro 11, 834×1194, DPR 2           | `touch`, `gestures`  | CI, or locally with `FNT_E2E_WEBKIT=1` |

Playwright's WebKit is the engine, not Safari. It catches pointer, canvas and
WebGL breakage; it cannot install to the Home Screen or rotate a real device.
Those stay below.

The gallery (`npm run gallery`, ADR 0006) captures five Chromium projects,
the Surface and the iPad on both backends and the iPad upright, from the
production build. It is a review artefact published as a CI artefact and at
`/gallery/` on Pages, never a gate.

Never run `playwright install` in the dev container: Chromium is preinstalled at
`PLAYWRIGHT_BROWSERS_PATH`. On a machine of your own, `npx playwright install
webkit` once, then `FNT_E2E_WEBKIT=1 npm run e2e`.

## Manual iPad checklist

Run against the deployed Pages URL before a release tag. Record the iPad
model, iPadOS version and the `?stats=1` numbers in the PR.

1. **Safari tab.** Open the URL. Title screen renders; New game works through party setup.
2. **Home Screen.** Share → Add to Home Screen. Launch from the icon: no browser chrome, status bar translucent, app title "FN Tactics".
3. **Offline.** Enable Airplane Mode, relaunch from the icon: the title screen loads and a saved game continues.
4. **Fight, landscape.** Enter the first fight. The whole board is visible; tiles are at least 40 CSS px; every action-bar button is at least 48 px at Normal and Largest text.
5. **Pinch and pan.** Pinch in over a unit: the unit stays under the fingers, Recentre appears. Drag: the board pans and stops at the edge. Tap Recentre: whole board back, button gone.
6. **Long press.** Hold on an enemy: the inspector opens with no iOS callout sheet.
7. **Tooltips.** Tap a turn-strip chip and a status chip: a toast shows the text.
8. **Rotate to portrait mid-fight.** The HUD stacks under the map; the acting unit is on screen; the board fits at 40 px tiles or pans if it cannot.
9. **Hand-off.** Two players: the banner covers the map; taps on the map behind it do nothing; "I'm ready" clears it and the acting unit is centred if the board does not fit.
10. **Performance.** Add `?stats=1`. On the quarry map with the boss out, during a 5×5 blast: 55 fps or better in landscape.
11. **Fallback.** Add `?renderer=canvas`: the fight is playable, high ground, walls and cover still read, effects are simpler.
12. **Settings.** Largest text, Patterned ground, Reduce motion, Higher contrast each apply immediately and survive a relaunch.
13. **Hidden grid.** A move range shows as one rounded contour and the path as a curve with an arrowhead; a tap on a tile inside the contour lands on that tile. Settings → Show grid brings the lines back and survives a relaunch.
14. **Effects.** Cast fire, water, earth and air once each: four different things, each with a wind-up, a hit and an aftermath. A 5×5 storm on the quarry floor with `?stats=1` holds 55 fps. Reduce motion collapses a cast to an instant and the numbers still show.
15. **Atmosphere.** The board sits in the dark frame with dimmed corners and holds 58 fps idle; the quarry's ledges and pits read as height from across the table; Higher contrast removes the shading and keeps the board readable.
16. **Figures.** Every unit stands about a tile tall with its health bar clear of the head; the party faces right and the bandits face left. Pinch to the maximum zoom on the quarry with the boss out: every unit still draws (the canvas memory cap).
17. **HUD.** The acting unit's portrait sits in the unit panel ringed in its element; every ability button shows its element glyph and stays 48 px tall at Largest text.
18. **Gallery.** Open `/gallery/` from the Pages URL: every project's pictures load, and the figure page shows every unit in every pose.
19. **The shell in daylight.** Outdoors or by a window: the parchment HUD's text reads on every panel, the confirm bar's green button reads, and Higher contrast still helps rather than hurts.
20. **A painting under the grid.** On a map with a painting, Settings → Show grid: the road's edges and the pond's banks sit on the tile lines; the live puddle is tinted over the painting; Higher contrast brings the drawn tree, wall and ledge marks back over it.
21. **Zoomed into a painting.** Pinch to the maximum on a painted map on both renderers (`?renderer=canvas`, `?renderer=webgl`): the painting stays sharp and every unit still draws; `?stats=1` idles at 58 fps or better.
22. **The aim arc.** Aim a thrown ability (Rock Throw, Fire Blast) and tap a target: the arc lands on the tapped tile under the finger, ends in its arrowhead, and a strike up close or a self cast shows none.
