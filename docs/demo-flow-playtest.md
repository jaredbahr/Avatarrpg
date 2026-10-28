# Demo flow playtest, 2026-10-28

One recorded play of the demo, start to finish: title, party setup (three players: Kaya, Sura, Bo), the
opening, Ba Dan, the bending practice, Elder Mira, the east road, the forest walk and the ambush, a few turns
including a Fire Jab on the oil flask, the win and the aftermath. Every step is a real tap on the page
(`e2e/demo-flow.review.ts`), with two staged shortcuts, both written into each run's `beats.json`: Kaya is
stood within range of the flask on her first turn, and the enemies are set to 1 HP once the flask has
burst (or after twelve party turns), so the party finishes them with real attacks.

Scope changed mid-pass (coordinator, relaying the owner): the art direction itself may change, so this pass
records the play-through and the audit, and fixes only non-art faults in code. The style guide is **not**
locked, no art was changed and no PixelLab generation was spent. The art items below are recorded for the
direction decision, not scheduled.

## How it was recorded

```sh
# 1280x800 at 1 dpr, and iPad portrait (820x1180 at 2 dpr, touch), on either backend
npx playwright test -c playwright.demo-flow.config.ts --project desktop-canvas
#   projects: desktop-canvas, desktop-webgl, ipad-canvas, ipad-webgl
#   FNT_FLOW_LABEL=before|after, FNT_FLOW_DIR=<out> (default .shots/demo-flow)
sh scripts/review/flow-mp4.sh <video.webm> <out.mp4>
```

WebGL in this container is a software rasteriser (no GPU), so the WebGL run is several times slower than a
player would see; its stills are for fidelity, its timings are not. "Before" is `main` at 5cd5224; "after" is
this branch. Timestamps below are seconds into the **before, desktop, Canvas** recording
(`demo-flow-before-desktop-canvas.mp4`); the iPad and WebGL recordings have their own `beats.json`.

| beat                                   |     t (s) | beat                         |   t (s) |
| -------------------------------------- | --------: | ---------------------------- | ------: |
| title                                  |       3.4 | east gate                    |    48.5 |
| party setup (players, element, person) |   4.4–6.2 | forest road (fallback flash) |    49.5 |
| opening narration                      |       7.6 | "Into the Pines" narration   |    55.2 |
| Ba Dan arrival                         |      13.5 | ambush opening               |    64.4 |
| practice ready / bending / done        | 20.7–25.9 | first turn, flask aim        | 66.7–68 |
| Mira talk cue / conversation           | 27.6–30.5 | flask bend / burning         | 69.5–72 |
| after Mira                             |      36.3 | enemy turns                  |   80–89 |
| victory card / aftermath               | 121–129.7 |                              |         |

## Audit

Severity: **blocker** (breaks the scene or reads as a bug), **ugly** (clearly off, a player notices), **nit**.
Status: **fixed** (this branch, one commit each), **deferred** (with an estimate, for the owner), **art**
(waits on the art-direction decision), **ok** (checked, nothing to do).

### Transitions and camera

1. **blocker, fixed.** Walking off Ba Dan onto the forest road drew the forest's procedural fallback for
   about 0.3 s before its painting loaded: flat green, dark octagon "trees", a large flat placeholder figure
   (t = 49.5). The explore scene swaps maps in place, without the scene curtain, and the curtain only waited
   for character atlases anyway. The swap is now curtained and the lift waits for the map's painting and
   scene pieces inside the existing bound (`e2e/map-curtain.spec.ts`).
2. **ugly, fixed.** The practice held the camera on Kaya at the explore zoom; Sura and Bo bent off screen or
   under the header (t = 21–26, iPad still 11). The camera now glides to frame the benders and leans toward
   the mark, then glides back to the leader; reduce motion cuts.
3. **ugly, deferred.** The ambush fires on the crossing at x 8, but the fight opens with the party back on
   the map's west spawns (x 1–3), so the party appears to jump back down the road (t = 57–67). Spawning the
   party from its walked trail is an encounter and rules change (spawns are part of the map's lesson about
   which side the hazards sit on). Estimate: half a day to a day including the balance run.
4. **ugly, deferred.** Enemy turns cut the camera across the board to the bruisers and back, and each enemy
   walks the full distance at the explore pace (two bruisers took 9 s between Sura's and Bo's turns,
   t = 80–89). Options: a pan instead of a cut, and a quicker enemy move pace in combat. Estimate: 2–4 h
   for the pan; the pace is the owner's call after ADR 0095.
5. **nit, ok.** The battle opening's ink curtain (0.4 s, t = 64) and its overview pan read as intended.
6. **nit, deferred.** The first party turn frames only the party; the enemies and the flask are off screen
   until they move (still 22). The opening pan shows them once; a "show enemies" step on the first turn
   would help. Estimate: 1–2 h.

### UI overlapping the board

7. **ugly, deferred.** The objective card (about 430 x 90 px at 1280 wide) covers the board's top-left
   corner, which is where the trailing party stands when walking east and where the practice mark sits
   (stills 08, 13). Options: collapse it to one line after the first read, or move the objective into the
   header plate. Estimate: 2–4 h with the Large-text checks.
8. **ugly, deferred.** iPad portrait combat: the header wraps "Pause" onto a second row, and the unit card
   stretches empty to the height of the confirm stack, so the board gets under half the screen (iPad still
   23). Folding the view buttons behind More in portrait (as on a phone) is the likely fix, but it changes
   the WebKit iPad specs that only run in CI. Estimate: half a day with CI.
9. **nit, deferred.** A walk bark ("Heavy boots thud onto the road…") overlaps the objective card's text
   (t = 62–64). Estimate: 1 h (offset barks below the card).
10. **nit, ok.** The ambush intro bubble covers the board's top edge while the opening plays; it is
    transient.

### Talk cues

11. **ugly, art.** The talk cue over a speaker is a flat gold disc (Mira, Pella; stills 13, 15), the only
    vector shape over the painted village. Recorded for the art direction.
12. **ok.** Talk lights up with the speaker's name from two tiles away and the walk-up plays before the
    conversation opens.

### Figures in odd spots

13. **blocker, fixed.** Talk walked the party to the nearest tile beside Elder Mira, which from the road is
    a shallow canal cell, so her conversation opened with Kaya standing in the water (still 14). The
    approach now prefers a dry tile.
14. **ugly, deferred.** The party wades straight through Ba Dan's canal and the forest puddle (both are
    walkable shallow water by rule) with no wading cue, so figures look as if they stand on the water
    (stills 15, combat 26). Options: make the canal walkable only at the bridge and stepping stones (a map
    change with path tests), or a wading mask (art). Estimate: half a day for the map option.
15. **nit, deferred.** After the fight the party returns to the crossing at (8,4), so Kaya stands in front
    of the rubble heap and reads as standing on it (aftermath still). Same root as item 3.
16. **nit, art.** At the figure scale 1.25 adjacent figures overlap heavily (a thug drawn over Kaya in the
    puddle, combat still 25). Expected until the ~74 px redraw.

### Depth sort and pop, z-fighting

17. **ok.** On this route no party member walks behind a house, so the silhouette reveal (ADR 0096) is not
    exercised. No pop or z-fighting seen in either backend's recording.

### Mismatched art families

18. **ugly, art.** Combat overlays are smooth vector shapes over pixel art: the move and target rings, the
    red dashed aim line, the red intent arrows beside enemies, the red X on knocked-out units, the gold
    selection ellipse in exploration (stills 23–28).
19. **ugly, art.** Oil and fire surfaces draw as flat diamonds (Canvas) or a smooth glowing diamond (WebGL)
    with no flame, so burning oil reads as an orange rug (still 25, both backends).
20. **nit, art.** The exit marker is a cream vector arrow on the paving (still 16).

### Text truncation

21. **ugly, fixed.** iPad portrait: the speaker's name under the portrait was cut to "Elder M…" (iPad still
    14). It now wraps there; the phone's row layout keeps the ellipsis.
22. **ugly, fixed.** iPad portrait: the flask's consequence chip ran off the dock mid-word ("… — af", iPad
    still 23). Consequence chips now wrap inside the dock.
23. **ugly, deferred.** The ability description in the action header is one line with an ellipsis on both
    sizes ("…it lights any oil the targ…"); the oil hint is the map's lesson. The header is fixed-height on
    purpose so the board keeps its rows. Option: a two-line clamp with the header always two lines.
    Estimate: 2 h with the refit check.
24. **nit, deferred.** The prop chip names grid coordinates, "Oil Flask at (14,7)" for the flask at grid
    (13,6); no other screen shows a coordinate. Estimate: 30 min (drop the coordinates).

### Timing that drags

25. **ok, noted.** Crossing Ba Dan from Mira to the east gate takes about 12 s (t = 36–48) at the chosen
    750 ms a tile (ADR 0095); every trip is 1.5 times longer than before that choice. The owner's call.
26. **ugly, deferred.** Enemy turns, see item 4.
27. **nit, ok.** The practice shows "Gathering the party" for about a second before the first bend.

### Combat readability

28. **ugly, deferred.** At 1280 x 800 the fight runs at integer zoom 1 (64 px tiles): figures about 74 px,
    health bars about 20 x 3 px with no frame, the acting unit marked only by a thin ellipse. The turn strip
    is 90 px tall for six chips. Readability depends on the HUD more than the board.
29. **ugly, deferred.** During an enemy turn the action dock shows the enemy's own controls, greyed
    ("Bruiser: choose an action…", Move, Club Swing, Rush), next to "Enemies are moving…". Showing a plain
    "Bruiser is acting" card instead is about 1–2 h.
30. **nit, deferred.** The "still has 4 AP, tap End turn again" warning stays up into the enemies' turn.
    Estimate: 30 min.

### Bend effects at 1.25

31. **ugly, art.** At zoom 1 a Fire Jab is a small spark; 0.7 s after Confirm nothing of it is left (still
    24). The practice bends read better at zoom 2. Effects are drawn at the world grain (ADR 0086) and the
    figures at 1.25, so the effect is small next to its caster; recorded for the art direction.

### The ending and aftermath

32. **nit, fixed.** The victory card said "Everyone who went down is patched up" after a fight in which
    nobody went down. It now says so only when someone fell.
33. **nit, fixed.** Behind the victory card the turn strip still plated whoever had been acting.
34. **nit, deferred.** The board behind the victory card is dimmed and not framed on the party; there is no
    victory beat before the card. Estimate: 2–3 h for a short hold on the party.
35. **ok.** The party's after-fight lines play in exploration with the right speaker portrait, and the
    objective updates to the open road.

## Fixed in this branch

Items 1, 2, 13, 21, 22, 32 and 33, one commit each, plus the review fixture, its mp4 script and the map
curtain spec. No art, no PixelLab generation, no ADR (no engine, rendering contract, asset format or budget
changed).

## Recordings and stills

In `art/source/demo-flow/review/` (scaled for the repository: desktop 960 x 600, iPad 614 x 884, 24 fps):

- `demo-flow-before-desktop-canvas.mp4`, `demo-flow-after-desktop-canvas.mp4`
- `demo-flow-before-ipad-canvas.mp4`, `demo-flow-after-ipad-canvas.mp4`
- `beats-<before|after>-<desktop|ipad>-canvas.webp`: every beat's still on one sheet
- before and after pairs, named by audit item: `01-map-change-flash.webp`, `02-practice-framing.webp`,
  `13-mira-dry-ground.webp`, `21-ipad-speaker-name.webp`, `22-ipad-consequence-chip.webp`,
  `32-33-victory-card.webp`

The full-size recordings, the WebGL runs and every still at 1280 x 800 and iPad size are written by the
fixture under `.shots/demo-flow/<label>/<project>/` (not committed); rerun it to regenerate them.
