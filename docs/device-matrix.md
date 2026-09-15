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
