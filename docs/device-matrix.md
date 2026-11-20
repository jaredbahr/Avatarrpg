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

## Where the saves live, and what can delete them

Every save (three slots and the autosave) is in `localStorage`. Read from the publishers' own pages and source on
2026-11-14 for #772; nothing here was measured on the family's devices yet. **Source** means the page says it in
words, **code** means it was read in the browser's source with no page saying so, and **not confirmed** means no
primary source was found. The answers only the real iPad can give are in the checklist that follows.

### An iPad or iPhone (Safari, and every other browser there: all are WebKit)

| Question                                             | Answer                                                                                                                                                                                                                                       | Standing                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Can a tab's saves be deleted with no one asking?     | Yes. WebKit deletes "all of a website's script-writable storage after seven days of Safari use without user interaction on the site". It applies to every site, not only to trackers.                                                        | Source: [WebKit, 24 Mar 2020][itp-2020] (iPadOS 13.4, Safari 13.1); [Tracking Prevention][itp-doc], still listed; the removal code is on the Safari 26 branches.  |
| What does it delete?                                 | IndexedDB, LocalStorage, media keys, SessionStorage, service worker registrations and cache. So a second copy in IndexedDB goes at the same moment as the first.                                                                             | Source: [itp-doc]. The Cache API and the Origin Private File System are not named: not confirmed either way.                                                      |
| What is a "day"?                                     | A day on which the browser was used. A fortnight with the iPad in a drawer counts for nothing; seven days of other browsing without a tap in the game counts in full. A tap, click or key press in the game restarts it; scrolling does not. | Interaction: source ([itp-doc]). The day count: code (`OperatingDates`), plus "7 days of browser use" in [WebKit bug 237350][bug-237350].                         |
| Is it still seven days?                              | Assume seven. Since the Safari 18 branches the code waits 30 days of use for a site never reached through a decorated cross-site link, but no page or release note says so.                                                                  | Code only (`shouldRemoveAllButCookiesFor`; [WebKit bug 265598][bug-265598]). Not confirmed for a shipping Safari.                                                 |
| Is a Home Screen web app exempt?                     | Yes. "The first-party domain of home screen web applications is exempt from ITP's 7-day cap on all script-writeable storage".                                                                                                                | Source: [itp-doc].                                                                                                                                                |
| Does it see the tab's saves?                         | No. "The website data of home screen web applications is kept isolated from Safari". A game started in a tab has to be carried over: Save a copy in the tab, then Load, Import from file in the Home Screen app.                             | Isolation: source ([itp-doc]). That nothing is copied when the icon is made is stated for the Mac only ([Safari 17.0][safari-17]); not confirmed for iPadOS.      |
| Does every Home Screen icon count?                   | On iPadOS 26 an added site opens as a web app by default; with "Open as Web App" switched off it is a bookmark that opens in Safari, with Safari's storage and Safari's rule.                                                                | Default: source ([Safari 26.0][safari-26]). The bookmark's storage: inferred.                                                                                     |
| What does `navigator.storage.persist()` answer?      | No prompt. `true` only for a site WebKit already exempts (a Home Screen web app); `false` in a tab. Available from Safari 15.2, "fully supported" from 17.0.                                                                                 | "Heuristics like whether the website is opened as a Home Screen Web App": source ([WebKit, 10 Aug 2023][storage-2023]). `false` in a tab: code (`persistOrigin`). |
| What does a `true` protect?                          | Deletion when storage runs short. No page says it protects from the seven-day rule; in practice the two coincide, because only an exempt site gets `true`.                                                                                   | Source for eviction ([storage-2023]). Exemption through `persist()`: not confirmed.                                                                               |
| When storage runs short?                             | Whole sites go, least recently used first, `localStorage` included; a site with an open page, or in persistent mode, "might be excluded". A site may use up to about 60% of the disk in Safari or as a web app.                              | Source: [storage-2023] (Safari 17.0).                                                                                                                             |
| Chrome or Edge on the iPad?                          | The same engine and the same tracking prevention, on by default in every WKWebView app since iOS 14.                                                                                                                                         | Source: [WebKit, App-Bound Domains, 2020][app-bound]. The seven-day rule is not named there for those apps: inferred.                                             |
| Does "Save a copy" make a file from the Home Screen? | Unknown. A download inside a web app has opened a preview with its own save step (iOS 17) and has stranded the page (iOS 15); nothing was found for iPadOS 18 or 26.                                                                         | Not confirmed ([WebKit bug 275288][bug-275288], [236943][bug-236943]). Checklist step 6 measures it.                                                              |

### A PC (Chrome or Edge, the Steam Remote Play route)

| Question                                           | Answer                                                                                                                                                                                                                            | Standing                                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Is there a seven-day rule?                         | No. Deleting sites "that aren't used regularly ... happens only in Safari".                                                                                                                                                       | Source: [MDN, Storage quotas and eviction criteria][mdn-quota].                                                                                                   |
| When the disk runs out?                            | Chromium clears "all site data from the least recently used origin first". Its own design note calls only IndexedDB, the Cache API, the file system and service workers quota-managed; "local storage is not quota-managed data". | Source: [web.dev][webdev-storage] (2024). `localStorage` staying out of it: implied by the [Chromium storage note][cr-quota] (Oct 2024) and its code, not stated. |
| Any time limit at all?                             | Quota-managed data a site has not touched for 400 days is cleared. By the row above that is not `localStorage`.                                                                                                                   | Source: [cr-quota]; code (`kStaleBucketCutoffInDays`).                                                                                                            |
| What does `persist()` answer?                      | No prompt. `true` when the site is installed, bookmarked, allowed notifications or much used; otherwise `false`, and it may be asked again. A fresh Steam profile will say `false` at first.                                      | Source: [web.dev, Persistent storage][webdev-persist] (2020). The fresh profile: code (`persistent_storage_permission_context.cc`).                               |
| What does a `true` protect?                        | Persistent storage is "only deleted if the user chooses to remove it using their site settings".                                                                                                                                  | Source: [webdev-persist].                                                                                                                                         |
| Does a dedicated `--user-data-dir` keep the saves? | The folder holds the whole profile, so the saves are files inside it and return on the next launch. Back up that folder and the saves are backed up.                                                                              | Profile: source ([Chromium, user data directory][cr-udd]). `localStorage` by name and "between launches": not stated there; our own run is recorded below.        |
| What would empty it?                               | Incognito or Guest; the setting that clears site data when the browser closes; and **Edge with `--kiosk`, which runs InPrivate**. Use `--app=<url>` for the borderless window, never Edge's kiosk mode.                           | Source: [cr-quota]; [Microsoft, Edge kiosk mode][edge-kiosk] (2025). Chrome's own `--kiosk` and `--app`: not confirmed.                                           |

### What follows from it

- **The Home Screen icon is the defence on the iPad**, and it is the only one. Nothing a page can write outlasts the
  seven-day rule in a tab: IndexedDB, the Origin Private File System, the service worker's cache and script-made
  cookies are deleted with `localStorage`, as one site. Writing the saves to a second store there would cost code and
  change nothing, so the game does not.
- **On a PC a second store would be worse, not better:** IndexedDB and the Origin Private File System are the
  quota-managed data Chromium evicts, and `localStorage` is the one store it leaves out.
- **The file is the only copy outside the browser.** "Save a copy" at a region's end and "Export to file" in the Save
  menu write the same `.json`; the Save menu's Storage check says how old the last one is.
- **The game asks once** (`navigator.storage.persist()`, after the first save of a run), which costs nothing and is
  answered without a prompt on both platforms. While the answer is no and the game is not on the Home Screen, the title
  and the Save menu say so in one line, worded for an iPad tab or for a PC (`src/app/storage/persistence.ts`).
- **A real file on the PC is possible and not built.** Chrome and Edge (86 and later, not Safari or Firefox) can keep a
  handle to a file the family picked and rewrite it at every save ([File System Access][cr-fsa]); after a restart the
  browser asks again, once, unless "Allow on every visit" was chosen ([Chrome 122][cr-fsa-perm]). It would put the
  autosave in a folder OneDrive already backs up. It needs a new control and a permission prompt, so it waits for the
  owner's yes; whether the prompt appears in an `--app=` window is not confirmed.

### Run here, in the dev container (Chromium, 2026-11-14)

Playwright's Chromium against the production build (`vite preview`), launched twice on one dedicated profile folder
with `--app=<url>`, the Steam shortcut's shape. It is Chromium on Linux, not Chrome on the family PC.

| Step                              | Seen                                                                                                             |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Fresh profile, before a save      | `persisted()` false; the title shows the PC line; the store is still empty                                       |
| Save to Slot 1                    | the game asks; `persist()` answers false with no prompt; the line stays; "Storage first used" is stamped         |
| Export                            | a 1.9 KB `.json` downloads; "Last copy saved to a file" reads today                                              |
| Quit, relaunch on the same folder | Continue is there, both slots, the settings and the same "Storage first used"; `persisted()` still false         |
| The profile folder                | the saves are under `Default/Local Storage`, so copying the folder copies them                                   |
| Load a save, Storage check, there | "Opened from: A browser tab" (an `--app` window is not an installed app), "Browser has agreed to keep saves: No" |

[itp-2020]: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/
[itp-doc]: https://webkit.org/tracking-prevention/
[storage-2023]: https://webkit.org/blog/14403/updates-to-storage-policy/
[safari-17]: https://webkit.org/blog/14445/webkit-features-in-safari-17-0/
[safari-26]: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
[app-bound]: https://webkit.org/blog/10882/app-bound-domains/
[bug-237350]: https://bugs.webkit.org/show_bug.cgi?id=237350
[bug-265598]: https://bugs.webkit.org/show_bug.cgi?id=265598
[bug-275288]: https://bugs.webkit.org/show_bug.cgi?id=275288
[bug-236943]: https://bugs.webkit.org/show_bug.cgi?id=236943
[mdn-quota]: https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
[webdev-storage]: https://web.dev/articles/storage-for-the-web
[webdev-persist]: https://web.dev/articles/persistent-storage
[cr-quota]: https://docs.google.com/document/d/19QemRTdIxYaJ4gkHYf2WWBNPbpuZQDNMpUVf8dQxj4U/
[cr-udd]: https://chromium.googlesource.com/chromium/src/+/main/docs/user_data_dir.md
[cr-fsa]: https://developer.chrome.com/docs/capabilities/web-apis/file-system-access
[cr-fsa-perm]: https://developer.chrome.com/blog/persistent-permissions-for-the-file-system-access-api
[edge-kiosk]: https://learn.microsoft.com/en-us/deployedge/microsoft-edge-configure-kiosk-mode

## Saves on the real iPad: a ten-minute check (#772)

Run once on the family iPad against the deployed URL, then fill in the table. The Save menu's Storage check (Load a save on the title, Save in a game) shows every
answer in large type, so nothing needs a cable or a console. Steps 1 to 7 take about ten minutes; step 8 is one look, a
week or more later.

1. **Tab, before a save.** Open the URL in Safari. Load a save, Storage check. Write down "Opened from" and "Browser has
   agreed to keep saves".
2. **Tab, after a save.** New game, the suggested party, play until the first scene changes (that autosaves). Back to the
   title: is there a line under the buttons that starts "Saves made in a browser tab"? Storage check again: write down
   "Answer when the game asked" and "Storage first used".
3. **A copy from the tab.** In the game, Save, Export to file. Does a `.json` land in the Files app (Downloads)? Write
   down what Safari showed.
4. **Home Screen.** Share, Add to Home Screen, leave "Open as Web App" on. Launch from the icon. Is the title empty (no
   Continue)? That is expected: write it down either way.
5. **Carry the game over.** Load a save, Import from file, pick the file from step 3. Does the game continue where the
   tab left it? Save once into Slot 1.
6. **A copy from the Home Screen.** Save, Export to file. Does a file land in Files, does a preview open, or does
   nothing happen? If a preview opens, can it be saved from there, and can you get back to the game?
7. **Home Screen, storage check.** Save, Storage check: write down all three answers, and "Storage first used". The
   title should show no line about saves.
8. **A week or more later** (seven or more days on which Safari was used, without opening the game in a tab): open the
   **tab** and the **Home Screen app**. Is Continue still there in each? Storage check: has "Storage first used" moved
   forward, or gone back to "No date yet", in either? Either one is a wipe.

| What                                                                | Safari tab | Home Screen app |
| ------------------------------------------------------------------- | ---------- | --------------- |
| iPad model, iPadOS version                                          |            |                 |
| Browser has agreed to keep saves, before a save (1, 7)              |            |                 |
| Answer when the game asked (2, 7)                                   |            |                 |
| The line about saves shows on the title (2, 7)                      |            |                 |
| Export makes a file in Files; what the browser showed (3, 6)        |            |                 |
| The tab's saves are visible without importing (4)                   | n/a        |                 |
| Import from file continues the game (5)                             | n/a        |                 |
| Storage first used, on the day (2, 7)                               |            |                 |
| Days of Safari use before the second look; Continue still there (8) |            |                 |
| Storage first used, at the second look (8)                          |            |                 |

**On the PC, once, when the Steam shortcut exists:** launch it, start a game, quit from Steam, launch again: Continue
is there. Storage check, "Browser has agreed to keep saves": write the answer here. Note the browser and the exact
launch options beside it.

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
production build. CI requires successful capture and publishes a downloadable
artifact for seven days; visual acceptance still requires inspecting the images.
Publishing `/gallery/` on Pages is an optional manual action described in the
[gallery guide](gallery.md).

Never run `playwright install` in the dev container: Chromium is preinstalled at
`PLAYWRIGHT_BROWSERS_PATH`. On a machine of your own, `npx playwright install
webkit` once, then `FNT_E2E_WEBKIT=1 npm run e2e`.

Two local clones must not share one preview server: outside CI Playwright
reuses a server already on the port, so run the second one with
`FNT_E2E_PORT=4191 npm run e2e` (default 4173, as in CI).

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
18. **Gallery.** Open the CI gallery artifact (or an explicitly published Pages gallery): every project's pictures load, and the figure page shows every unit in every pose.
19. **The shell in daylight.** Outdoors or by a window: the parchment HUD's text reads on every panel, the confirm bar's green button reads, and Higher contrast still helps rather than hurts.
20. **A painting under the grid.** On a map with a painting, Settings → Show grid: the road's edges and the pond's banks sit on the tile lines; the live puddle is tinted over the painting; Higher contrast brings the drawn tree, wall and ledge marks back over it.
21. **Zoomed into a painting.** Pinch to the maximum on a painted map on both renderers (`?renderer=canvas`, `?renderer=webgl`): the painting stays sharp and every unit still draws; `?stats=1` idles at 58 fps or better.
22. **The aim arc.** Aim a thrown ability (Rock Throw, Fire Blast) and tap a target: the arc lands on the tapped tile under the finger, ends in its arrowhead, and a strike up close or a self cast shows none.
23. **The party walk.** In the village, tap a tile six away: the leader walks the route and the others follow in a line a tile apart, each in their own figure; nobody teleports, a tap mid-walk does nothing, and Reduce motion collapses the walk to an instant with everyone in place.
24. **The roster.** Every member shows the framed portrait with its element badge, name, player, level, health and action pips, the leader's row on the gold plate; a row opens that member's inspector. At Largest text every row and every hotbar button is at least 48 px. Rotate to portrait: the roster becomes a strip above the map and the hotbar stays under it.
25. **The hotbar and the gate.** Talk is off away from everyone and names the nearest villager within three tiles; tapping it walks the party over and opens their lines. Party opens the leader's inspector, Save the slots, Pause the menu. Walk up beside the east gate: the banner names the road; step onto it and the story moves on.
26. **Sound unlocks.** Launch from the Home Screen with the ring/silent switch set to _ring_. Settings → Sound reads Normal. Tap anything, then walk a tile: a footstep. Sound never has to be asked for twice — send the app to the background and come back, and the next tap still sounds.
27. **The elements have voices.** Cast fire, water, earth, air and lightning once each. Each should be recognisably a different thing: fire rushes and falls away, water is lower and rounder, earth lands with weight under a strike, air is wide and breathy and rising, lightning cracks and is gone. A hit lands with its own sound under whatever threw it; an oil flask splinters; a unit going down is heavier than a hit. A twenty-five tile storm must sound like one event, not twenty-five.
28. **Off is off, and quiet is usable.** Settings → Sound → Off: nothing sounds, and nothing sounds after a reload either. Quiet is audible in a quiet room without being the loudest thing in it. At Largest text the four Sound buttons are each at least 48 px. With the iPad's silent switch on, the game makes no sound and nothing breaks — every control still works.

## Keyboard and gamepad (ADR 0115)

A PC window is driven by mouse, keyboard or controller, and a Steam Remote Play guest often has only a
controller. Every screen takes all of them through one action layer; the bindings are in ADR 0115 §2.

| Covered where                               | What it proves                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `src/app/input/*.test.ts` (pull requests)   | Key and pad maps, cursor snapping, cycle order, focus graph, glyphs       |
| `e2e/keyboard-flow.spec.ts` (browser suite) | Keys alone: title, settings, setup, story, walking, map, pause, the fight |
| `e2e/gamepad-play.spec.ts` (browser suite)  | The same route on a synthetic standard-mapping pad                        |

The pad in the suite is a stand-in for `navigator.getGamepads()`. It proves the mapping and the routing,
not any real controller, driver or stream.

## Manual controller and Remote Play checklist (ten minutes)

Run on the PC that will host, in the browser window Steam will share. Note the controller model, how it is
connected (USB, Bluetooth, through Steam) and the browser.

**A real controller, alone (about four minutes).** Put the mouse and keyboard aside.

1. **Wake it.** At the title, press A (the bottom face button). New game takes a focus ring, and a second
   press opens party setup. If nothing happens, press a different button once: browsers hide a pad until
   its first press.
2. **Menus.** D-pad to "Start with the suggested party", A. Press A through the opening. The Next button
   shows the pad's own confirm mark (A, or ✕ on a PlayStation pad).
3. **Walk.** In Ba Dan, tap the d-pad: one tile a press. Hold it: the party strides on and stops within
   three tiles of letting go. Try the left stick the same way. Walk into Elder Mira: she talks.
4. **Look and map.** Right stick pans the view; the triggers zoom; pressing the right stick recentres.
   View (Select) opens the local map; B closes it. Menu (Start) pauses; B resumes.
5. **A fight.** Take the east road and walk east into the roadblock. On your turn the d-pad moves along
   the action bar; A on Move puts a cursor on the board, d-pad moves it tile to tile, A walks, B backs out.
   A on an ability starts on the nearest enemy; RB and LB step through targets; A confirms. Y ends the turn
   (twice if action points are left). Up from the bar looks over the board; X inspects.
6. **Glyphs.** The legend at the foot of the map names the buttons printed on this controller. Touch the
   mouse: the legend goes. Press a pad button: it comes back.

**Hot-seat on one controller (about two minutes).** Start a two-player game.

7. The hand-off card reads "Pass the controller to" and the next player's name. Hold A down from the last
   turn: the card stays. Let go and press A: it clears.

**One Steam Remote Play session with a friend (about four minutes).** Add the browser as a non-Steam game
(`docs/pipeline-proof-plan.md` §5), start a session and invite one friend.

8. **Does the invite work at all** for a non-Steam shortcut? If not, note what Steam offered instead.
9. **The guest's controller.** The friend presses A at the title. Does the game react? Which glyphs does
   the legend show for them (Steam usually presents a guest as an Xbox pad)?
10. **Guest keyboard and mouse,** if Steam is set to share them: arrows walk, Enter confirms, a right click
    backs out of an aim.
11. **Two pads at once.** Host and guest each press a direction in the village. Both work; nothing fights.
12. **Lag.** With the guest moving the board cursor, is a held d-pad easy to stop on a tile? If it
    overshoots, say so: the repeat rate is one number (`PAD_REPEAT_EVERY_MS`).
13. **Names.** A guest on a controller cannot type a player name. Did Steam's on-screen keyboard appear in
    the name field, or was Skip names enough?
14. **The vote.** At a story choice, the secret vote is not secret on a shared stream. Settings → Story
    choices → Take turns is the remote-table setting; confirm it reads well for the guest.
