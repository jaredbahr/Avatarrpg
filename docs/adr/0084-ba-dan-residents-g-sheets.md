# ADR 0084: Ba Dan's residents walk on G sheets

**Status:** Accepted
**Date:** 2026-10-27

## Context

Ba Dan's residents were still the older art: Mira, Gao, Pella and Dorin as one static illustrated image each
(`art/npcs/*.png`), the relief watch and Pella's household adult as procedural painter figures. A walking resident slid
a still picture across the village with a procedural bob and lean, at a marker scale of 1.5 (images) or 1.4 (painters),
not the party's 1.25, so their figures and shadows were sized differently from the party standing beside them. The
riverside drew them as painted villager figures (`LOOKS` in `VillageLife.ts`) whatever their sprite.

Issue #284 generated all six at Kaya's G standard (`art/source/<name>-g`, `art/source/residents-g-design/README.md`):
eight headings, idle 4 and walk 8, edited from Kaya's G south and animated from CMU capture. The owner chose to ship them
for a playable Ba Dan demo with walk and idle animation on 27 October 2026 (Route A at G1).

## Decision

1. **Sheets.** `scripts/art/resident-g.ts` packs each resident's `assembly.json` takes into
   `public/art/units/<name>-g.webp` (one 2048x1344 page) through the G build's own `normalise`, and pins the source and
   decoded cels in `art/source/<name>-g/pins.json`, which `art:validate` holds the WebP to. Each heading's placement is
   solved, not hand set, against the bounds `art:validate` holds every eight-way sheet to (the enemy packer's rules,
   `enemy-g.ts`). The manifest's `residentGSheet` registers them under the residents' existing keys: `npc.household`,
   `npc.guard` (the relief watch), `npc.elder` (Mira), `npc.shopkeeper` (Gao), `npc.kid` (Pella), `npc.dorin`. They
   declare eight-way locomotion and share the enemy G walk's eight-cel stride timing. Hanru keeps his painter figure (his
   look is an owner decision); the returnees keep sharing the household and watch keys, now on these sheets, as do Dema
   (Mira's) and Sen (Gao's).
2. **No cast for a resident.** `validateContent` requires `idle` and `cast` of every sheet; an `npc.*` sheet only stands
   and walks on the map and is never cast in combat, so it needs `idle` alone.
3. **A marker draws a heading clip.** `NpcMarker.clip` names the clip an eight-way sheet draws; absent, a sheet draws its
   plain `walk` or `idle` as before (`npcClip`). Both backends draw a `facing: 'both'` sheet's heading clips unmirrored,
   as they draw the party's.
4. **Residents move like the party.** `ResidentWalks` gives a resident on an eight-way sheet the clip its walk's animator
   picks (the party's own locomotion, with its planted cels on a turn and on the stop) and afterwards the idle of the
   heading it walked, looping on the resident clock; before it has walked it faces the camera, south-east or south-west
   by its facing. The procedural walk bob, idle breath and walking lean are dropped, because the sheet authors its own;
   a work stop's lean stays, as the routine's only work beat until the sheets carry a work idle. A figure stays
   `walking` for its whole route, through a planted turn. The riverside draws such a resident from its sheet like the
   party, through the same figure scale; `LOOKS` is gone.
5. **Same scale, same shadow.** `npcPresentationScale` stands an eight-way sheet at `partyScale` (1.25 oblique). An NPC
   drawn from any sheet now takes the party's default ground pool where its scene has no contact layer (it was images
   only); painter figures are unchanged.
6. **The talk pip sits over the head.** It was placed at `FOOT_LINE - 0.08` of the marker scale, which the illustrated
   images filled; on a G figure at 1.25 that is its face. `npcPipLift` puts it 0.12 tiles above the head measured on the
   packed cels (0.9 tiles at scale 1 for an adult, 0.68 for Pella); painter and image figures keep the old height.

## Measurements

| Sheet         | WebP        | JSON      |
| ------------- | ----------- | --------- |
| `household-g` | 186,098 B   | 19,427 B  |
| `watch-g`     | 190,958 B   | 19,007 B  |
| `mira-g`      | 214,282 B   | 19,006 B  |
| `gao-g`       | 229,948 B   | 19,525 B  |
| `pella-g`     | 157,334 B   | 18,799 B  |
| `dorin-g`     | 193,276 B   | 19,007 B  |
| **All six**   | 1,171,896 B | 114,771 B |

`npm run check:assets` after a build: units 7.64 MiB of 8.5 MiB (ADR 0082, unchanged), precache 24.62 MB of 25 MB. No
budget is raised. The old `art/npcs/*.png` (0.09 MB) stay on disk, drawn by nothing; removing them is the cheapest
precache headroom if a later sheet needs it.

## Consequences

- Every resident walks the eight headings with authored feet and idles in place at the party's size, on both backends,
  in Ba Dan and on the riverside. `baDanDepth.test.ts`'s actor scales are unchanged: the residents now draw at the
  party's 1.25, Hanru at 1.4 and the image markers at 1.5.
- The measured faults are in each `review/faults.md`. The largest is idle boil (20-47% of head and torso pixels change
  between cels against Kaya's 6-17%), which PixelLab's per-cel redraw causes; Dorin's north and south walks are lifted
  4-5 px so their reaching foot stays inside the stride bound.
- The household adult's parked basket errand (`PARKED_ROUTINES`) was waiting on this art; releasing it is a separate
  content change.
- Precache headroom is about 0.38 MB, so the next sheet needs a decision of its own.
